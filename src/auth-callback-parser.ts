import { err, ok, Result, type Result as ResultType } from 'neverthrow'
import { OAuthCallbackParseError } from './errors.js'
import type { ParsedOAuthCallback } from './types.js'

export function parseOAuthCallbackUriString(
  uriString: string
): ResultType<ParsedOAuthCallback, OAuthCallbackParseError> {
  const urlResult = Result.fromThrowable(
    () => new URL(uriString),
    (error: unknown) =>
      new OAuthCallbackParseError(
        'Invalid callback URL',
        error instanceof Error ? error : undefined
      )
  )()

  if (urlResult.isErr()) return err(urlResult.error)

  const url = urlResult.value

  if (!url.pathname.startsWith('/auth-callback')) {
    return err(new OAuthCallbackParseError(`Unexpected callback path: ${url.pathname}`))
  }

  const errorDescription =
    url.searchParams.get('error_description') ?? url.searchParams.get('error')
  if (errorDescription) {
    return err(new OAuthCallbackParseError(`OAuth error: ${errorDescription}`))
  }

  const code = url.searchParams.get('code')
  if (code) return ok({ kind: 'code', code })

  const rawHash = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash
  const decodedHash = rawHash.includes('%') ? decodeURIComponent(rawHash) : rawHash
  const fragmentParameters = new URLSearchParams(decodedHash)

  const accessToken = fragmentParameters.get('access_token') ?? undefined
  const refreshToken = fragmentParameters.get('refresh_token') ?? undefined
  const expiresAtRaw = fragmentParameters.get('expires_at') ?? undefined

  if (!accessToken || !refreshToken) {
    return err(new OAuthCallbackParseError('Missing code and missing access_token/refresh_token'))
  }

  const expiresAtNumber = expiresAtRaw ? Number(expiresAtRaw) : undefined

  return ok({
    kind: 'implicit',
    accessToken,
    refreshToken,
    expiresAtUnixSeconds: Number.isFinite(expiresAtNumber) ? expiresAtNumber : undefined,
  })
}
