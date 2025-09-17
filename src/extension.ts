import * as vscode from 'vscode'
import { loadAndProcessHtml } from './csp-helper.js'

type WebviewConfig = {
  readonly enableScripts: boolean
  readonly retainContextWhenHidden?: boolean
  readonly localResourceRoots: readonly vscode.Uri[]
}

class BabaDeluxeWebviewProvider implements vscode.WebviewViewProvider {
  private static get _webviewDistPath() {
    return 'dist/webview'
  }

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public async resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): Promise<void> {
    this._configureWebview(webviewView.webview)

    try {
      webviewView.webview.html = await this._loadWebviewContent(webviewView.webview)
    } catch (error) {
      await this._handleWebviewError('Failed to load sidebar webview', error)
    }
  }

  private _configureWebview(webview: vscode.Webview): void {
    webview.options = this._createWebviewConfig()
  }

  private _createWebviewConfig(): WebviewConfig {
    return {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this._extensionUri, BabaDeluxeWebviewProvider._webviewDistPath),
      ],
    }
  }

  private async _loadWebviewContent(webview: vscode.Webview): Promise<string> {
    return loadAndProcessHtml(this._extensionUri, webview)
  }

  private async _handleWebviewError(message: string, error: unknown): Promise<void> {
    console.error(`BabaDeluxe Extension Error: ${message}`, error)
    await vscode.window.showErrorMessage(message)
  }
}

class ChatPanelManager {
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

export function activate(context: vscode.ExtensionContext): void {
  const provider = new BabaDeluxeWebviewProvider(context.extensionUri)
  const chatManager = new ChatPanelManager(context.extensionUri)

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('babadeluxe-ai-coder-panel', provider),
    vscode.commands.registerCommand('babadeluxe-ai-coder.openChat', async () =>
      chatManager.createChatPanel()
    )
  )
}
