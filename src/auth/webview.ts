import type * as vscode from 'vscode'
import { logger } from '../system/log.js'
import type { WebviewMessage, SupabaseSessionPayload } from './types.js'
import type { SupabaseOAuthController } from './supabase.js'

type OutgoingAuthMessage =
  | { type: 'auth.session'; session: SupabaseSessionPayload | undefined }
  | { type: 'auth.error'; message: string }

const isAuthGetSessionMessage = (message: WebviewMessage): message is { type: 'auth.getSession' } =>
  message.type === 'auth.getSession'

const isAuthLoginMessage = (message: WebviewMessage): message is { type: 'auth.login' } =>
  message.type === 'auth.login'

export class WebviewAuthController implements vscode.Disposable {
  private readonly _disposables: vscode.Disposable[] = []

  public constructor(
    private readonly _supabaseOAuthController: SupabaseOAuthController,
    private readonly _postMessage: (message: OutgoingAuthMessage) => Thenable<boolean>
  ) {
    this._disposables.push(
      this._supabaseOAuthController.onDidChangeSession((session) => {
        void this._postMessage({ type: 'auth.session', session })
      })
    )
  }

  public dispose(): void {
    for (const disposable of this._disposables) disposable.dispose()
    this._disposables.length = 0
  }

  public async handleWebviewMessage(message: WebviewMessage): Promise<boolean> {
    if (isAuthGetSessionMessage(message)) {
      const sessionResult = await this._supabaseOAuthController.getStoredSession()
      await (sessionResult.isErr()
        ? this._postMessage({ type: 'auth.error', message: sessionResult.error.message })
        : this._postMessage({ type: 'auth.session', session: sessionResult.value }))

      return true
    }

    if (isAuthLoginMessage(message)) {
      const loginResult = await this._supabaseOAuthController.startGitHubLogin()
      if (loginResult.isErr()) {
        logger.warn('startGitHubLogin failed:', loginResult.error)
        await this._postMessage({ type: 'auth.error', message: loginResult.error.message })
      } else {
        // Session arrives later via onDidChangeSession after OAuth callback completes.
        await this._postMessage({ type: 'auth.session', session: undefined })
      }

      return true
    }

    return false
  }
}
