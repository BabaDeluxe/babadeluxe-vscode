import * as vscode from 'vscode'
import { loadAndProcessHtml } from './csp-helper.js'

export class ChatPanelManager {
  private static get _panelType() {
    return 'babadeluxe-ai-coder-chat'
  }

  private static get _panelTitle() {
    return 'BabaDeluxe AI Coder - Chat'
  }

  private static get _webviewDistPath() {
    return 'dist/webview'
  }

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public async createChatPanel(): Promise<void> {
    try {
      const panel = this._createWebviewPanel()
      panel.webview.html = await loadAndProcessHtml(this._extensionUri, panel.webview)
    } catch (error) {
      await this._handlePanelError('Failed to open chat panel', error)
    }
  }

  private _createWebviewPanel(): vscode.WebviewPanel {
    return vscode.window.createWebviewPanel(
      ChatPanelManager._panelType,
      ChatPanelManager._panelTitle,
      vscode.ViewColumn.One,
      this._createPanelOptions()
    )
  }

  private _createPanelOptions(): vscode.WebviewPanelOptions & vscode.WebviewOptions {
    return {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this._extensionUri, ChatPanelManager._webviewDistPath),
      ],
    }
  }

  private async _handlePanelError(message: string, error: unknown): Promise<void> {
    console.error(`BabaDeluxe Extension Error: ${message}`, error)
    await vscode.window.showErrorMessage(message)
  }
}
