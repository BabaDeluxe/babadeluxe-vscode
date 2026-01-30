import type * as vscode from 'vscode'
import type {
  ContextClearAllMessage,
  ContextSnapshotMessage,
  ContextUnpinFileMessage,
  PinFileMessage,
  PinSnippetMessage,
  UiTextRange,
  WebviewMessage,
} from './types.js'
import type { ContextPinsStore } from './context-pins-store.js'

export type PostStatus = Readonly<{ kind: 'posted' } | { kind: 'queued' }>

type SidebarReadyMessage = Readonly<{ type: 'sidebar.ready' }>

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isUiTextRange = (value: unknown): value is UiTextRange => {
  if (!isRecord(value)) return false
  return (
    typeof value['startLine'] === 'number' &&
    typeof value['startCharacter'] === 'number' &&
    typeof value['endLine'] === 'number' &&
    typeof value['endCharacter'] === 'number'
  )
}

const isPinFileMessage = (message: unknown): message is PinFileMessage => {
  if (!isRecord(message)) return false
  return message['type'] === 'context:pinFile' && typeof message['filePath'] === 'string'
}

const isPinSnippetMessage = (message: unknown): message is PinSnippetMessage => {
  if (!isRecord(message)) return false
  return (
    message['type'] === 'context:pinSnippet' &&
    typeof message['id'] === 'string' &&
    typeof message['filePath'] === 'string' &&
    typeof message['snippet'] === 'string' &&
    isUiTextRange(message['range'])
  )
}

const isSidebarReadyMessage = (message: WebviewMessage): message is SidebarReadyMessage =>
  message.type === 'sidebar.ready'

const isContextUnpinFileMessage = (message: WebviewMessage): message is ContextUnpinFileMessage =>
  message.type === 'context:unpinFile' &&
  typeof (message as { filePath?: unknown }).filePath === 'string'

const isContextClearAllMessage = (message: WebviewMessage): message is ContextClearAllMessage =>
  message.type === 'context:clearAll'

export class WebviewPinsController {
  private _webview?: vscode.Webview
  private _isReady = false

  public constructor(private readonly _pinsStore: ContextPinsStore) {}

  public attach(webview: vscode.Webview): void {
    this._webview = webview
    this._isReady = false
  }

  public detach(): void {
    this._webview = undefined
    this._isReady = false
  }

  public async persistPinFromCommand(message: unknown): Promise<PostStatus> {
    if (isPinFileMessage(message)) {
      await this._pinsStore.upsertFilePin(message.filePath)
      await this._maybePostSnapshot()
      return this._webview && this._isReady ? { kind: 'posted' } : { kind: 'queued' }
    }

    if (isPinSnippetMessage(message)) {
      await this._pinsStore.upsertSnippetPin({
        id: message.id,
        filePath: message.filePath,
        snippet: message.snippet,
        range: message.range,
      })
      await this._maybePostSnapshot()
      return this._webview && this._isReady ? { kind: 'posted' } : { kind: 'queued' }
    }

    if (!this._webview) return { kind: 'queued' }

    const didPost = await this._webview.postMessage(message)
    return didPost ? { kind: 'posted' } : { kind: 'queued' }
  }

  public async handleWebviewMessage(message: WebviewMessage): Promise<boolean> {
    if (isSidebarReadyMessage(message)) {
      this._isReady = true
      await this._maybePostSnapshot()
      return true
    }

    if (isContextUnpinFileMessage(message)) {
      await this._pinsStore.unpinByFilePath(message.filePath)
      await this._maybePostSnapshot()
      return true
    }

    if (isContextClearAllMessage(message)) {
      await this._pinsStore.clear()
      await this._maybePostSnapshot()
      return true
    }

    return false
  }

  private async _maybePostSnapshot(): Promise<void> {
    if (!this._webview || !this._isReady) return
    const snapshot: ContextSnapshotMessage = this._pinsStore.readSnapshot()
    await this._webview.postMessage(snapshot)
  }
}
