import * as vscode from 'vscode'
import { loadAndProcessHtml } from './csp-helper.js'
import { logger } from './logger.js'
import { ContextPinsStore } from './context-pins-store.js'
import { WebviewPinsController } from './webview-pins-controller.js'
import { WebviewCommonController } from './webview-common-controller.js'
import type { WebviewMessage } from './types.js'

export class ChatPanelManager {
  private _currentPanel?: vscode.WebviewPanel
  private readonly _pinsController: WebviewPinsController

  public constructor(
    private readonly _extensionContext: vscode.ExtensionContext,
    private readonly _extensionUri: vscode.Uri
  ) {
    this._pinsController = new WebviewPinsController(new ContextPinsStore(_extensionContext))
  }

  public async createChatPanel(): Promise<void> {
    if (this._currentPanel) {
      this._currentPanel.reveal(vscode.ViewColumn.One)
      return
    }

    const panel = vscode.window.createWebviewPanel(
      'babadeluxe-ai-coder-chat',
      'BabaDeluxe AI Coder - Chat',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, 'dist/webview')],
      }
    )

    const commonController = new WebviewCommonController(this._extensionContext)
    this._pinsController.attach(panel.webview)

    this._currentPanel = panel
    panel.webview.html = await loadAndProcessHtml(this._extensionUri, panel.webview)

    commonController.postContextRoot(panel.webview)

    const cfgSub = vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('babadeluxe-ai-coder.contextRoot')) {
        commonController.postContextRoot(panel.webview)
      }
    })

    panel.webview.onDidReceiveMessage((message: WebviewMessage) => {
      void (async () => {
        if (await this._pinsController.handleWebviewMessage(message)) return
        await commonController.handleWebviewMessage(message, panel.webview)
      })()
    })

    panel.onDidDispose(() => {
      cfgSub.dispose()
      this._currentPanel = undefined
      this._pinsController.detach()
      commonController.dispose()
    })

    logger.log('Chat panel created')
  }
}
