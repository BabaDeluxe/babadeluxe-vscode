import * as vscode from 'vscode'
import { TextRange, UiTextRange } from '../scoring/types.js'
import { ContextClearAllMessage, ContextUnpinFileMessage } from '../context/types.js'

export type UiContextItem = {
  readonly id: string
  readonly kind: 'auto' | 'manual'
  readonly filePath?: string
  readonly snippet?: string
  readonly score?: number
  readonly matchRange?: TextRange
}

export type NavigateToMessage = Readonly<{
  type: 'navigate-to'
  payload: { view: string }
}>

export type WebviewMessage =
  | Readonly<{ type: 'sidebar.ready' }>
  | Readonly<{ type: 'contextRoot.getCurrent' }>
  | Readonly<{ type: 'contextRoot.pick' }>
  | Readonly<{ type: 'contextRoot.clear' }>
  | Readonly<{ type: 'contextRoot.openSettings' }>
  | Readonly<{ type: 'autoContext:request'; requestId: string; query: string }>
  | Readonly<{ type: 'fileContext:resolve'; requestId: string; filePaths: string[] }>
  | Readonly<{ type: 'auth.login' }>
  | Readonly<{ type: 'auth.getSession' }>
  | NavigateToMessage
  | ContextUnpinFileMessage
  | ContextClearAllMessage

export type WebviewCommonApi = {
  postContextRoot: (webview: vscode.Webview) => void
  handleWebviewMessage: (message: WebviewMessage, webview: vscode.Webview) => Promise<boolean>
}
