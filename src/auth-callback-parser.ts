import { err, ok, Result, type Result as ResultType } from 'neverthrow'
import { OAuthCallbackParseError } from './errors.js'
import type { ParsedOAuthCallback } from './types.js'

export function parseOAuthCallbackUriString(
  uriString: string,
  nowUnixSeconds?: number
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
  const expiresInRaw = fragmentParameters.get('expires_in') ?? undefined

  if (!accessToken || !refreshToken) {
    return err(new OAuthCallbackParseError('Missing code and missing access_token/refresh_token'))
  }

  let expiresAtUnixSeconds: number | undefined
  if (expiresInRaw) {
    const seconds = Number.parseInt(expiresInRaw, 10)
    if (Number.isFinite(seconds)) {
      const base = nowUnixSeconds ?? Math.floor(Date.now() / 1000)
      expiresAtUnixSeconds = base + seconds
    }
  }

  return ok({
    kind: 'implicit',
    accessToken,
    refreshToken,
    expiresAtUnixSeconds,
  })
}
