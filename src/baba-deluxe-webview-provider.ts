import * as vscode from 'vscode'
import { ok, type Result } from 'neverthrow'
import { loadAndProcessHtml } from './csp-helper.js'
import type { WebviewMessage } from './types.js'
import { logger } from './logger.js'
import type { SupabaseOAuthController } from './supabase-oauth-controller.js'
import type { SidebarWebviewNotReadyError } from './errors.js'
import { ContextPinsStore } from './context-pins-store.js'
import { WebviewPinsController, type PostStatus } from './webview-pins-controller.js'
import { WebviewCommonController } from './webview-common-controller.js'

export class BabaDeluxeWebviewProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  private _webview?: vscode.Webview
  private readonly _disposables: vscode.Disposable[] = []

  private readonly _pinsController: WebviewPinsController
  private readonly _commonController: WebviewCommonController

  public constructor(
    context: vscode.ExtensionContext,
    private readonly _extensionUri: vscode.Uri,
    private readonly _supabaseOAuthController: SupabaseOAuthController
  ) {
    this._pinsController = new WebviewPinsController(new ContextPinsStore(context))
    this._commonController = new WebviewCommonController(context)
  }

  public dispose(): void {
    for (const disposable of this._disposables) disposable.dispose()
    this._disposables.length = 0

    this._webview = undefined
    this._pinsController.detach()
    this._commonController.dispose()
  }

  public async resolveWebviewView(webviewView: vscode.WebviewView): Promise<void> {
    this._webview = webviewView.webview
    this._pinsController.attach(webviewView.webview)

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, 'dist/webview')],
    }

    webviewView.webview.html = await loadAndProcessHtml(this._extensionUri, webviewView.webview)

    this._disposables.push(
      webviewView.onDidDispose(() => {
        this._webview = undefined
        this._pinsController.detach()
      }),
      webviewView.webview.onDidReceiveMessage((message: WebviewMessage) => {
        void this._handleWebviewMessage(message)
      }),
      this._supabaseOAuthController.onDidChangeSession((session) => {
        void this._webview?.postMessage({ type: 'auth.session', session })
      }),
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration('babadeluxe-ai-coder.contextRoot') && this._webview)
          this._commonController.postContextRoot(this._webview)
      })
    )

    this._commonController.postContextRoot(webviewView.webview)
    logger.log('WebviewView resolved')
  }

  public async postMessageToSidebar(
    message: unknown
  ): Promise<Result<PostStatus, SidebarWebviewNotReadyError>> {
    const status = await this._pinsController.persistPinFromCommand(message)
    return ok(status)
  }

  private async _handleWebviewMessage(message: WebviewMessage): Promise<void> {
    if (await this._pinsController.handleWebviewMessage(message)) return
    if (
      this._webview &&
      (await this._commonController.handleWebviewMessage(message, this._webview))
    )
      return

    if (message.type === 'auth.login') {
      await this._handleAuthLogin()
      return
    }

    if (message.type === 'auth.getSession') {
      await this._handleAuthGetSession()
    }
  }

  private async _handleAuthLogin(): Promise<void> {
    const loginResult = await this._supabaseOAuthController.startGitHubLogin()
    if (loginResult.isErr()) {
      void this._webview?.postMessage({ type: 'auth.error', message: loginResult.error.message })
    }
  }

  private async _handleAuthGetSession(): Promise<void> {
    const sessionResult = await this._supabaseOAuthController.getStoredSession()

    if (sessionResult.isErr()) {
      logger.warn('Supabase session is invalid:', sessionResult.error)
      void this._webview?.postMessage({ type: 'auth.session', session: undefined })
      return
    }

    void this._webview?.postMessage({ type: 'auth.session', session: sessionResult.value })
  }
}
