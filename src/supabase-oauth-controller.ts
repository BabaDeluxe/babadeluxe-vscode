import * as vscode from 'vscode'
import { createClient } from '@supabase/supabase-js'
import { err, ok, ResultAsync, type Result } from 'neverthrow'
import { type JsonParseError, safeJsonParse } from '@babadeluxe/shared/utils'
import { parseOAuthCallbackUriString } from './auth-callback-parser.js'
import type { SupabaseSessionPayload, ExtensionLogger, SupabaseConfiguration } from './types.js'
import { SignInError } from './errors.js'

type SupabaseClientType = ReturnType<typeof createClient>

export class SupabaseOAuthController implements vscode.Disposable {
  public get onDidChangeSession(): vscode.Event<SupabaseSessionPayload | undefined> {
    return this._sessionEmitter.event
  }

  private readonly _sessionEmitter = new vscode.EventEmitter<SupabaseSessionPayload | undefined>()
  private readonly _disposables: vscode.Disposable[] = [this._sessionEmitter]

  public constructor(
    private readonly _extensionContext: vscode.ExtensionContext,
    private readonly _logger: ExtensionLogger
  ) {}

  public dispose(): void {
    for (const disposable of this._disposables) {
      disposable.dispose()
    }
  }

  public async getStoredSession(): Promise<
    Result<SupabaseSessionPayload | undefined, JsonParseError>
  > {
    const rawSession = await this._extensionContext.secrets.get(this._sessionSecretKey)
    if (!rawSession) return ok(undefined)

    const parsed = safeJsonParse(rawSession)
    if (parsed.isErr()) return err(parsed.error)

    this._logger.log('Got stored supabase payload:', parsed)

    return ok(parsed.value as SupabaseSessionPayload)
  }

  public readonly startGitHubLogin = async (): Promise<Result<void, Error>> => {
    const configurationResult = this._getSupabaseConfiguration()
    if (configurationResult.isErr()) {
      return err(configurationResult.error)
    }

    const extensionId = this._extensionContext.extension.id
    const callbackUriResult = await this._getCallbackUri(extensionId)
    if (callbackUriResult.isErr()) return err(callbackUriResult.error)

    const supabase = this._createSupabaseClient(configurationResult.value)

    const signInResult = await ResultAsync.fromPromise(
      supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: callbackUriResult.value.toString(),
          skipBrowserRedirect: true,
        },
      }),
      (error: unknown) => new SignInError(`Supabase signInWithOAuth failed: ${String(error)}`)
    )

    if (signInResult.isErr()) return err(signInResult.error)

    const { data } = signInResult.value
    if (!data?.url) {
      return err(new SignInError('Supabase signInWithOAuth did not return an auth URL'))
    }

    // Implicit flow URL fix: The client usually returns a URL with response_type=code by default
    // Unless flowType: 'implicit' is set in createClient options (which we did).
    // However, some versions might still default to PKCE in the URL generation.
    // If the URL contains 'response_type=code', we might need to manually force it,
    // But the createClient config should handle it.

    const openResult = await ResultAsync.fromPromise(
      vscode.env.openExternal(vscode.Uri.parse(data.url)),
      (error: unknown) => new Error(`Failed to open browser: ${String(error)}`)
    )

    if (openResult.isErr()) return err(openResult.error)

    return ok(undefined)
  }

  public readonly handleAuthCallback = async (uri: vscode.Uri): Promise<Result<void, Error>> => {
    // We do NOT need to create a client or load config just to parse the URL tokens.
    // We only need the config if we were doing code exchange.

    const parsedCallbackResult = parseOAuthCallbackUriString(uri.toString(true))
    if (parsedCallbackResult.isErr()) {
      // If parsing fails, it might be an invalid URI or just not an auth callback.
      // We log it but return Ok(undefined) to avoid crashing unrelated URI handling.
      this._logger.warn(`Failed to parse auth callback: ${parsedCallbackResult.error.message}`)
      return ok(undefined)
    }

    const parsedCallback = parsedCallbackResult.value

    if (parsedCallback.kind === 'code') {
      // STOP: We cannot handle 'code' because we lack the PKCE verifier in this context.
      // This means the implicit flow configuration failed.
      return err(
        new Error(
          'Received OAuth code but expected Implicit Flow tokens. PKCE is not supported in this context.'
        )
      )
    }

    // Success path: Implicit flow
    const sessionPayload: SupabaseSessionPayload = {
      accessToken: parsedCallback.accessToken,
      refreshToken: parsedCallback.refreshToken,
      expiresAtUnixSeconds: parsedCallback.expiresAtUnixSeconds,
    }

    await this._extensionContext.secrets.store(
      this._sessionSecretKey,
      JSON.stringify(sessionPayload)
    )

    // Notify subscribers (the webview)
    this._sessionEmitter.fire(sessionPayload)

    this._logger.log('OAuth success: Supabase session stored (implicit flow).')
    return ok(undefined)
  }

  private get _sessionSecretKey(): string {
    return 'supabase.session'
  }

  private _getSupabaseConfiguration(): Result<SupabaseConfiguration, Error> {
    const supabaseUrl = 'https://vspnxnpyzqskaiphkapr.supabase.co'
    const supabaseAnonKey = 'sb_publishable_KGxdYNkLclfDXSD0mSL_tA_ZlXByhrb'
    return ok({ supabaseUrl, supabaseAnonKey })
  }

  private _createSupabaseClient(configuration: SupabaseConfiguration): SupabaseClientType {
    return createClient(configuration.supabaseUrl, configuration.supabaseAnonKey, {
      auth: {
        // !!! IMPORTANT CHANGE: Force implicit flow to avoid PKCE/LocalStorage issues !!!
        flowType: 'implicit',
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })
  }

  private readonly _getCallbackUri = async (
    extensionId: string
  ): Promise<Result<vscode.Uri, Error>> => {
    const internalUri = vscode.Uri.parse(`${vscode.env.uriScheme}://${extensionId}/auth-callback`)

    const externalUriResult = await ResultAsync.fromPromise(
      vscode.env.asExternalUri(internalUri),
      (error: unknown) => new Error(`asExternalUri failed: ${String(error)}`)
    )

    return externalUriResult
  }
}
