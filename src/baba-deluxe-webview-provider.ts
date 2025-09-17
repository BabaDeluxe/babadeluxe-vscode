import * as vscode from 'vscode'
import { loadAndProcessHtml } from './csp-helper.js'
import type { WebviewConfig } from './extension.js'

export class BabaDeluxeWebviewProvider implements vscode.WebviewViewProvider {
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
