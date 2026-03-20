import { describe, expect, it, vi } from 'vitest'
import { WebviewAuthController } from '../../src/auth/webview-auth-controller.js'
import { SupabaseOAuthController } from '../../src/auth/supabase-oauth-controller.js'
import { ok, err } from 'neverthrow'

describe('WebviewAuthController', () => {
  it('handles auth.getSession message', async () => {
    const mockSession = { accessToken: 'at', refreshToken: 'rt', expiresAtUnixSeconds: 123 }
    const mockOAuthController = {
      getStoredSession: vi.fn().mockResolvedValue(ok(mockSession)),
      onDidChangeSession: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    } as unknown as SupabaseOAuthController

    const mockPostMessage = vi.fn().mockResolvedValue(true)
    const controller = new WebviewAuthController(mockOAuthController, mockPostMessage)

    const handled = await controller.handleWebviewMessage({ type: 'auth.getSession' })

    expect(handled).toBe(true)
    expect(mockPostMessage).toHaveBeenCalledWith({ type: 'auth.session', session: mockSession })
  })

  it('handles auth.login message', async () => {
    const mockOAuthController = {
      startGitHubLogin: vi.fn().mockResolvedValue(ok(undefined)),
      onDidChangeSession: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    } as unknown as SupabaseOAuthController

    const mockPostMessage = vi.fn().mockResolvedValue(true)
    const controller = new WebviewAuthController(mockOAuthController, mockPostMessage)

    const handled = await controller.handleWebviewMessage({ type: 'auth.login' })

    expect(handled).toBe(true)
    expect(mockOAuthController.startGitHubLogin).toHaveBeenCalled()
  })

  it('posts error message on failed login', async () => {
    const mockError = new Error('Login failed')
    const mockOAuthController = {
      startGitHubLogin: vi.fn().mockResolvedValue(err(mockError)),
      onDidChangeSession: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    } as unknown as SupabaseOAuthController

    const mockPostMessage = vi.fn().mockResolvedValue(true)
    const controller = new WebviewAuthController(mockOAuthController, mockPostMessage)

    const handled = await controller.handleWebviewMessage({ type: 'auth.login' })

    expect(handled).toBe(true)
    expect(mockPostMessage).toHaveBeenCalledWith({ type: 'auth.error', message: mockError.message })
  })
})
