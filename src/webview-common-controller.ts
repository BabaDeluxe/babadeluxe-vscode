import { Buffer } from 'node:buffer'
import * as path from 'node:path'
import * as vscode from 'vscode'
import { AutoContextSession } from './auto-context-session.js'
import type { UiContextItem, WebviewMessage } from './types.js'
import { logger } from './logger.js'
import { resolveContextRootFsPath } from './workspace-root.js'

export class WebviewCommonController implements vscode.Disposable {
  private readonly _autoContextSession: AutoContextSession

  public constructor(context: vscode.ExtensionContext) {
    this._autoContextSession = new AutoContextSession(context)
  }

  public dispose(): void {
    this._autoContextSession.dispose()
  }

  public postContextRoot(webview: vscode.Webview): void {
    const scopeUri = vscode.window.activeTextEditor?.document.uri
    const root = resolveContextRootFsPath(scopeUri) ?? null
    void webview.postMessage({ type: 'contextRoot.current', root })
  }

  public async handleWebviewMessage(
    message: WebviewMessage,
    webview: vscode.Webview
  ): Promise<boolean> {
    if (message.type === 'contextRoot.get') {
      this.postContextRoot(webview)
      return true
    }

    if (message.type === 'contextRoot.pick') {
      await vscode.commands.executeCommand('babadeluxe-ai-coder.setContextRoot')
      this.postContextRoot(webview)
      await this._maybeInitContextHandler()
      return true
    }

    if (message.type === 'contextRoot.clear') {
      await vscode.commands.executeCommand('babadeluxe-ai-coder.clearContextRoot')
      this.postContextRoot(webview)
      await this._maybeInitContextHandler()
      return true
    }

    if (message.type === 'contextRoot.openSettings') {
      await vscode.commands.executeCommand('babadeluxe-ai-coder.openSettings')
      return true
    }

    if (message.type === 'autoContext:request') {
      await this._handleAutoContextRequest(message.requestId, message.query, webview)
      return true
    }

    if (message.type === 'fileContext:resolve') {
      await this._handleFileContextResolve(message.requestId, message.filePaths, webview)
      return true
    }

    return false
  }

  private async _ensureRootOrPrompt(): Promise<string | undefined> {
    const scopeUri = vscode.window.activeTextEditor?.document.uri
    const existing = resolveContextRootFsPath(scopeUri)
    if (existing) return existing

    const choice = await vscode.window.showInformationMessage(
      'No context root set. Select a folder to use for context.',
      'Select folder…',
      'Open Settings'
    )

    if (choice === 'Select folder…') {
      await vscode.commands.executeCommand('babadeluxe-ai-coder.setContextRoot')
    } else if (choice === 'Open Settings') {
      await vscode.commands.executeCommand('babadeluxe-ai-coder.openSettings')
    }

    return resolveContextRootFsPath(scopeUri)
  }

  private async _maybeInitContextHandler(rootOverride?: string): Promise<void> {
    await this._autoContextSession.ensureInitialized(rootOverride)

    const root = this._autoContextSession.getRoot()
    if (!root) return

    logger.log(
      this._autoContextSession.getHandler()
        ? `[context] webview root set to: ${root}`
        : `[context] webview root not ready`
    )
  }

  private async _handleAutoContextRequest(
    requestId: string,
    query: string,
    webview: vscode.Webview
  ): Promise<void> {
    const root = await this._ensureRootOrPrompt()
    await this._maybeInitContextHandler(root)

    const contextHandler = this._autoContextSession.getHandler()
    if (!contextHandler) {
      void webview.postMessage({
        type: 'autoContext:response',
        requestId,
        error: 'No context root selected',
        items: [],
      })
      return
    }

    const result = await contextHandler.handleRequest(query)

    if (result.isErr()) {
      void webview.postMessage({
        type: 'autoContext:response',
        requestId,
        error: result.error.message,
        items: [],
      })
      return
    }

    const items: UiContextItem[] = result.value
    void webview.postMessage({ type: 'autoContext:response', requestId, items })
  }

  private async _handleFileContextResolve(
    requestId: string,
    filePaths: string[],
    webview: vscode.Webview
  ): Promise<void> {
    const root = await this._ensureRootOrPrompt()
    await this._maybeInitContextHandler(root)

    const finalRoot = this._autoContextSession.getRoot()
    if (!finalRoot) {
      void webview.postMessage({
        type: 'fileContext:response',
        requestId,
        error: 'No context root selected',
        items: [],
      })
      return
    }

    const unique = [
      ...new Set(
        filePaths.map((filePath) => filePath.trim()).filter((filePath) => filePath.length > 0)
      ),
    ]
    if (unique.length === 0) {
      void webview.postMessage({ type: 'fileContext:response', requestId, items: [] })
      return
    }

    const tasks = unique.map(async (filePath): Promise<UiContextItem> => {
      const fsPath = path.isAbsolute(filePath) ? filePath : path.join(finalRoot, filePath)
      const uri = vscode.Uri.file(fsPath)

      const bytes = await vscode.workspace.fs.readFile(uri)
      const content = Buffer.from(bytes).toString('utf8')
      const snippet = content.slice(0, 4000)

      return { id: `${requestId}:${filePath}`, kind: 'manual', filePath, snippet }
    })

    const results = await Promise.allSettled(tasks)

    const resolved: UiContextItem[] = []
    for (const [index, result] of results.entries()) {
      const filePath = unique[index]!
      if (result.status === 'fulfilled') resolved.push(result.value)
      else {
        const error = result.reason as unknown
        const message = error instanceof Error ? error.message : String(error)
        logger.warn(`Failed to read file "${filePath}": ${message}`)
      }
    }

    void webview.postMessage({ type: 'fileContext:response', requestId, items: resolved })
  }
}
