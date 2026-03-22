import { describe, expect, test as baseTest } from 'vitest'
import { parseOAuthCallbackUriString } from '../../src/auth/callback-parser.js'

export const test = baseTest.extend<{
  parseCallback: typeof parseOAuthCallbackUriString
}>({
  // eslint-disable-next-line no-empty-pattern
  async parseCallback({}, use) {
    await use(parseOAuthCallbackUriString)
  },
})

describe('parseOAuthCallbackUriString', () => {
  test('Parses PKCE code flow', () => {
    const result = parseOAuthCallbackUriString(
      'vscode://babadeluxe.babadeluxe-vscode/auth-callback?code=abc123&windowId=100'
    )

    if (result.isErr()) {
      throw result.error
    }

    expect(result.value.kind).toBe('code')
    if (result.value.kind === 'code') {
      expect(result.value.code).toBe('abc123')
    }
  })

  test('Parses implicit hash flow', () => {
    const url =
      'https://example.com/auth-callback#access_token=at123&refresh_token=rt456&expires_in=3600'

    const now = 1768998634 // 1768998634 + 3600 = 1769002234

    const result = parseOAuthCallbackUriString(url, now)

    expect(result.isOk()).toBe(true)
    if (result.isErr()) throw result.error

    expect(result.value.kind).toBe('implicit')
    if (result.value.kind !== 'implicit') throw new Error('Expected implicit flow')
    expect(result.value.accessToken).toBe('at123')
    expect(result.value.refreshToken).toBe('rt456')
    expect(result.value.expiresAtUnixSeconds).toBe(1769002234)
  })

  test('Rejects wrong path', () => {
    const result = parseOAuthCallbackUriString(
      'vscode://babadeluxe.babadeluxe-vscode/not-auth-callback?code=abc'
    )

    expect(result.isErr()).toBe(true)
  })

  test('Rejects missing code and tokens', () => {
    const result = parseOAuthCallbackUriString(
      'vscode://babadeluxe.babadeluxe-vscode/auth-callback?windowId=100'
    )

    expect(result.isErr()).toBe(true)
  })
})
