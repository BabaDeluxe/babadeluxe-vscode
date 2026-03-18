/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/naming-convention */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { registerLazyCommands } from '../../src/commands/register-lazy-commands.js'
import type {
  CommandDependencies,
  ExtensionCommand,
  LazyCommandEntry,
} from '../../src/commands/types.js'
import { logger } from '../../src/logger.js'

vi.mock('vscode', () => ({
  ExtensionContext: {},
  Uri: {
    file: (path: string) => ({ fsPath: path, scheme: 'file', path }),
  },
  window: {
    showInformationMessage: vi.fn(),
    showWarningMessage: vi.fn(),
    showErrorMessage: vi.fn(),
  },
  workspace: {
    getConfiguration: vi.fn(),
    workspaceFolders: [],
  },
  commands: {
    executeCommand: vi.fn(),
  },
}))

describe('registerLazyCommands', () => {
  const createMockDependencies = (): CommandDependencies => {
    vi.mock(import('vscode'), () => {
      return {
        context: {} as any,
        vscode,
        logger,
        sidebar: {
          postMessageToSidebar: vi.fn().mockResolvedValue({ isOk: () => true, value: undefined }),
        },
        openChat: vi.fn().mockResolvedValue(undefined),
      }
    })
  }

  const createMockCommandClass = (runMock = vi.fn().mockResolvedValue(undefined)) => {
    return class MockCommand implements ExtensionCommand {
      async run(dependencies: CommandDependencies, ...args: unknown[]): Promise<void> {
        await runMock(dependencies, ...args)
      }
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns command map with all registry entries', () => {
    const mockDependencies = createMockDependencies()
    const MockCommand1 = createMockCommandClass()
    const MockCommand2 = createMockCommandClass()

    const mockRegistry: LazyCommandEntry[] = [
      {
        manifest: { commandId: 'test.command1', title: 'Test 1' },
        load: async () => MockCommand1,
      },
      {
        manifest: { commandId: 'test.command2', title: 'Test 2' },
        load: async () => MockCommand2,
      },
    ]

    const result = registerLazyCommands({
      dependencies: mockDependencies,
      entries: mockRegistry,
    })

    expect(Object.keys(result)).toHaveLength(2)
    expect(result).toHaveProperty('test.command1')
    expect(result).toHaveProperty('test.command2')
    expect(typeof result['test.command1']).toBe('function')
    expect(typeof result['test.command2']).toBe('function')
  })

  it('does not call load() during registration (lazy loading)', () => {
    const mockDependencies = createMockDependencies()
    const MockCommand = createMockCommandClass()
    const loadSpy = vi.fn().mockResolvedValue(MockCommand)

    const mockRegistry: LazyCommandEntry[] = [
      {
        manifest: { commandId: 'test.command', title: 'Test' },
        load: loadSpy,
      },
    ]

    registerLazyCommands({
      dependencies: mockDependencies,
      entries: mockRegistry,
    })
    expect(loadSpy).not.toHaveBeenCalled()
  })

  it('calls load() only when handler is executed', async () => {
    const mockDependencies = createMockDependencies()
    const runMock = vi.fn().mockResolvedValue(undefined)
    const MockCommand = createMockCommandClass(runMock)
    const loadSpy = vi.fn().mockResolvedValue(MockCommand)

    const mockRegistry: LazyCommandEntry[] = [
      {
        manifest: { commandId: 'test.command', title: 'Test' },
        load: loadSpy,
      },
    ]

    const handlers = registerLazyCommands({
      dependencies: mockDependencies,
      entries: mockRegistry,
    })
    expect(loadSpy).not.toHaveBeenCalled()
    await handlers['test.command']?.('arg1', 'arg2')
    expect(loadSpy).toHaveBeenCalledTimes(1)
    expect(runMock).toHaveBeenCalledWith(mockDependencies, 'arg1', 'arg2')
  })

  it('caches command instance after first load', async () => {
    const mockDependencies = createMockDependencies()
    const runMock = vi.fn().mockResolvedValue(undefined)
    const MockCommand = createMockCommandClass(runMock)
    const loadSpy = vi.fn().mockResolvedValue(MockCommand)

    const mockRegistry: LazyCommandEntry[] = [
      {
        manifest: { commandId: 'test.command', title: 'Test' },
        load: loadSpy,
      },
    ]

    const handlers = registerLazyCommands({
      dependencies: mockDependencies,
      entries: mockRegistry,
    })
    await handlers['test.command']?.()
    await handlers['test.command']?.()
    expect(loadSpy).toHaveBeenCalledTimes(1)
    expect(runMock).toHaveBeenCalledTimes(2)
  })

  it('propagates errors from load()', async () => {
    const mockDependencies = createMockDependencies()
    const loadError = new Error('Failed to load command module')
    const loadSpy = vi.fn().mockRejectedValue(loadError)

    const mockRegistry: LazyCommandEntry[] = [
      {
        manifest: { commandId: 'test.command', title: 'Test' },
        load: loadSpy,
      },
    ]

    const handlers = registerLazyCommands({
      dependencies: mockDependencies,
      entries: mockRegistry,
    })
    await expect(handlers['test.command']?.()).rejects.toThrow('Failed to load command module')
  })

  it('propagates errors from run()', async () => {
    const mockDependencies = createMockDependencies()
    const runError = new Error('Command execution failed')
    const runMock = vi.fn().mockRejectedValue(runError)
    const MockCommand = createMockCommandClass(runMock)

    const mockRegistry: LazyCommandEntry[] = [
      {
        manifest: { commandId: 'test.command', title: 'Test' },
        load: async () => MockCommand,
      },
    ]

    const handlers = registerLazyCommands({
      dependencies: mockDependencies,
      entries: mockRegistry,
    })
    await expect(handlers['test.command']?.()).rejects.toThrow('Command execution failed')
  })

  it('passes dependencies and arguments to command run method', async () => {
    const mockDependencies = createMockDependencies()
    const runMock = vi.fn().mockResolvedValue(undefined)
    const MockCommand = createMockCommandClass(runMock)

    const mockRegistry: LazyCommandEntry[] = [
      {
        manifest: { commandId: 'test.command', title: 'Test' },
        load: async () => MockCommand,
      },
    ]

    const handlers = registerLazyCommands({
      dependencies: mockDependencies,
      entries: mockRegistry,
    })

    const testArg1 = { uri: 'file:///test.ts' }
    const testArg2 = 'stringArg'

    await handlers['test.command']?.(testArg1, testArg2)

    expect(runMock).toHaveBeenCalledWith(mockDependencies, testArg1, testArg2)
    expect(runMock).toHaveBeenCalledTimes(1)
  })

  it('handles multiple commands independently', async () => {
    const mockDependencies = createMockDependencies()
    const runMock1 = vi.fn().mockResolvedValue(undefined)
    const runMock2 = vi.fn().mockResolvedValue(undefined)
    const MockCommand1 = createMockCommandClass(runMock1)
    const MockCommand2 = createMockCommandClass(runMock2)

    const mockRegistry: LazyCommandEntry[] = [
      {
        manifest: { commandId: 'test.command1', title: 'Test 1' },
        load: async () => MockCommand1,
      },
      {
        manifest: { commandId: 'test.command2', title: 'Test 2' },
        load: async () => MockCommand2,
      },
    ]

    const handlers = registerLazyCommands({
      dependencies: mockDependencies,
      entries: mockRegistry,
    })
    await handlers['test.command1']?.('arg1')
    await handlers['test.command2']?.('arg2')
    expect(runMock1).toHaveBeenCalledWith(mockDependencies, 'arg1')
    expect(runMock2).toHaveBeenCalledWith(mockDependencies, 'arg2')
  })
})
