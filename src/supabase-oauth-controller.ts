import * as vscode from 'vscode'
import { createClient } from '@supabase/supabase-js'
import { err, ok, ResultAsync, type Result } from 'neverthrow'
import { type JsonParseError, safeJsonParse } from '@babadeluxe/shared/utils'
import { parseOAuthCallbackUriString } from './auth-callback-parser.js'
import type { SupabaseSessionPayload, ExtensionLogger, SupabaseConfiguration } from './types.js'

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

    if (!rawSession) {
      return ok(undefined)
    }

    const parsed = safeJsonParse(rawSession)
    if (parsed.isErr()) {
      return err(parsed.error)
    }

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
      (error: unknown) => new Error(`Supabase signInWithOAuth failed: ${String(error)}`)
    )

    if (signInResult.isErr()) return err(signInResult.error)

    const { data } = signInResult.value
    if (!data?.url) {
      return err(new Error('Supabase signInWithOAuth did not return an auth URL'))
    }

    const openResult = await ResultAsync.fromPromise(
      vscode.env.openExternal(vscode.Uri.parse(data.url)),
      (error: unknown) => new Error(`Failed to open browser: ${String(error)}`)
    )

    if (openResult.isErr()) return err(openResult.error)

    return ok(undefined)
  }

  public readonly handleAuthCallback = async (uri: vscode.Uri): Promise<Result<void, Error>> => {
    const configurationResult = this._getSupabaseConfiguration()
    if (configurationResult.isErr()) {
      return err(configurationResult.error)
    }

    const parsedCallbackResult = parseOAuthCallbackUriString(uri.toString(true))
    if (parsedCallbackResult.isErr()) {
      return ok(undefined)
    }

    const parsedCallback = parsedCallbackResult.value
    const supabase = this._createSupabaseClient(configurationResult.value)

    if (parsedCallback.kind === 'code') {
      const exchangeResult = await ResultAsync.fromPromise(
        supabase.auth.exchangeCodeForSession(parsedCallback.code),
        (error: unknown) => new Error(`exchangeCodeForSession failed: ${String(error)}`)
      )

      if (exchangeResult.isErr()) {
        return err(exchangeResult.error)
      }

      const { data, error } = exchangeResult.value
      if (error) {
        return err(new Error(`exchangeCodeForSession returned error: ${error.message}`))
      }

      if (!data.session) {
        return err(new Error('No session returned from exchangeCodeForSession'))
      }

      const sessionPayload: SupabaseSessionPayload = {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAtUnixSeconds: data.session.expires_at ?? undefined,
      }

      await this._extensionContext.secrets.store(
        this._sessionSecretKey,
        JSON.stringify(sessionPayload)
      )
      this._sessionEmitter.fire(sessionPayload)

      this._logger.log('OAuth success: Supabase session stored (code flow).')
      return ok(undefined)
    }

    const sessionPayload: SupabaseSessionPayload = {
      accessToken: parsedCallback.accessToken,
      refreshToken: parsedCallback.refreshToken,
      expiresAtUnixSeconds: parsedCallback.expiresAtUnixSeconds,
    }

    await this._extensionContext.secrets.store(
      this._sessionSecretKey,
      JSON.stringify(sessionPayload)
    )
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
        flowType: 'pkce',
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
