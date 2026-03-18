/* eslint-disable @typescript-eslint/no-unsafe-call */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ok, err } from 'neverthrow'
import { WebviewAuthController } from '../../src/auth/webview-auth-controller.js'

describe('WebviewAuthController', () => {
  let postMessages: any[]
  let postMessage: (m: any) => Promise<boolean>
  let onDidChangeSessionHandlers: Array<(s: any) => void>
  let supabaseController: any
  let controller: WebviewAuthController

  beforeEach(() => {
    postMessages = []
    postMessage = async (m) => {
      postMessages.push(m)
      return true
    }

    onDidChangeSessionHandlers = []
    supabaseController = {
      getStoredSession: vi.fn(),
      startGitHubLogin: vi.fn(),
      onDidChangeSession(handler: (s: any) => void) {
        onDidChangeSessionHandlers.push(handler)
        return { dispose: vi.fn() }
      },
    }

    controller = new WebviewAuthController(supabaseController, postMessage)
  })

  it('forwards session changes to webview', () => {
    const session = {
      accessToken: 'at',
      refreshToken: 'rt',
      expiresAtUnixSeconds: 123,
    }

    onDidChangeSessionHandlers[0]?.(session)

    expect(postMessages).toEqual([{ type: 'auth.session', session }])
  })

  it('handles auth.getSession success', async () => {
    supabaseController.getStoredSession.mockResolvedValueOnce(ok({ foo: 'bar' }))

    const handled = await controller.handleWebviewMessage({ type: 'auth.getSession' } as any)

    expect(handled).toBe(true)
    expect(postMessages).toEqual([{ type: 'auth.session', session: { foo: 'bar' } }])
  })

  it('handles auth.getSession error', async () => {
    const error = new Error('boom')
    supabaseController.getStoredSession.mockResolvedValueOnce(err(error))

    const handled = await controller.handleWebviewMessage({ type: 'auth.getSession' } as any)

    expect(handled).toBe(true)
    expect(postMessages).toEqual([{ type: 'auth.error', message: 'boom' }])
  })

  it('handles auth.login success', async () => {
    supabaseController.startGitHubLogin.mockResolvedValueOnce(ok(undefined))

    const handled = await controller.handleWebviewMessage({ type: 'auth.login' } as any)

    expect(handled).toBe(true)
    expect(postMessages).toEqual([{ type: 'auth.session', session: undefined }])
  })

  it('handles auth.login error', async () => {
    const error = new Error('login failed')
    supabaseController.startGitHubLogin.mockResolvedValueOnce(err(error))

    const handled = await controller.handleWebviewMessage({ type: 'auth.login' } as any)

    expect(handled).toBe(true)
    expect(postMessages).toEqual([{ type: 'auth.error', message: 'login failed' }])
  })

  it('returns false for unrelated message types', async () => {
    const handled = await controller.handleWebviewMessage({ type: 'other' } as any)

    expect(handled).toBe(false)
    expect(postMessages).toEqual([])
  })
})
