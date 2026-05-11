import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as vscode from 'vscode'
import { detectAiApiKeys } from '../src/api-key-detector/detector.js'
import { KNOWN_SETTING_KEYS } from '../src/api-key-detector/constants.js'

vi.mock('vscode', () => {
  const mockConfig = {
    inspect: vi.fn(),
    get: vi.fn(),
  }
  const mockWorkspace = {
    getConfiguration: vi.fn(() => mockConfig),
    workspaceFolders: undefined,
    fs: {
      readFile: vi.fn(),
    },
  }
  return {
    workspace: mockWorkspace,
    Uri: {
      joinPath: vi.fn((base, ...parts) => ({ fsPath: `${base.fsPath}/${parts.join('/')}` })),
      file: vi.fn((path) => ({ fsPath: path })),
    },
    ConfigurationTarget: {
      Global: 1,
      Workspace: 2,
    },
  }
})

describe('api-key-detector', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(vscode.workspace.getConfiguration() as any).inspect.mockReturnValue(undefined)
    ;(vscode.workspace as any).workspaceFolders = undefined
  })

  it('detects a known API key from User settings', async () => {
    const mockInspect = (vscode.workspace.getConfiguration() as any).inspect
    mockInspect.mockImplementation((key: string) => {
      if (key === 'continue.models') {
        return { globalValue: 'sk-1234567890abcdef1234567890abcdef' }
      }
      return undefined
    })

    const result = await detectAiApiKeys()
    expect(result.isOk()).toBe(true)
    const detected = result._unsafeUnwrap()
    expect(detected).toHaveLength(1)
    expect(detected[0]).toMatchObject({
      provider: 'continue',
      key: 'sk-1234567890abcdef1234567890abcdef',
      source: 'user-settings',
    })
  })

  it('detects unknown keys from .vscode/settings.json via heuristic', async () => {
    const mockFs = vscode.workspace.fs
    ;(vscode.workspace as any).workspaceFolders = [
      { uri: { fsPath: '/mock/workspace' } }
    ]

    const mockSettings = JSON.stringify({
      'some.custom.openai_api_key': 'sk-openai-key-123',
    })
    ;(mockFs.readFile as any).mockResolvedValue(Buffer.from(mockSettings))

    const result = await detectAiApiKeys()
    expect(result.isOk()).toBe(true)
    const detected = result._unsafeUnwrap()
    expect(detected).toHaveLength(1)
    expect(detected[0]).toMatchObject({
      provider: 'openai',
      key: 'sk-openai-key-123',
      source: 'dot-vscode-settings',
    })
  })

  it('deduplicates keys by provider, taking the first one', async () => {
    const mockInspect = (vscode.workspace.getConfiguration() as any).inspect
    mockInspect.mockImplementation((key: string) => {
      if (key === 'openai.apiKey') {
        return { globalValue: 'sk-user-key' }
      }
      return undefined
    })

    ;(vscode.workspace as any).workspaceFolders = [
      { uri: { fsPath: '/mock/workspace' } }
    ]
    const mockSettings = JSON.stringify({
      'openai.apiKey': 'sk-workspace-key',
    })
    ;(vscode.workspace.fs.readFile as any).mockResolvedValue(Buffer.from(mockSettings))

    const result = await detectAiApiKeys()
    expect(result.isOk()).toBe(true)
    const detected = result._unsafeUnwrap()

    // Should only have 1 'openai' key, even if found in two places
    expect(detected).toHaveLength(1)
    expect(detected[0].provider).toBe('openai')
    expect(detected[0].key).toBe('sk-user-key') // User settings checked first
  })

  it('handles errors during detection gracefully', async () => {
    const mockInspect = (vscode.workspace.getConfiguration() as any).inspect
    mockInspect.mockImplementation(() => {
      throw new Error('Unexpected crash')
    })

    const result = await detectAiApiKeys()
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().message).toContain('Failed to detect API keys')
  })
})
