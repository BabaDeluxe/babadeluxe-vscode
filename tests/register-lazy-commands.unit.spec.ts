import { describe, expect, it, vi } from 'vitest'
import { registerLazyCommands } from '../src/commands/register-lazy-commands.js'
import type { CommandDependencies, LazyCommandEntry, ExtensionCommand } from '../src/commands/types.js'

describe('registerLazyCommands', () => {
  it('registers and runs commands', async () => {
    const mockRun = vi.fn().mockResolvedValue(undefined)

    const mockEntry: LazyCommandEntry = {
      manifest: { commandId: 'test.command', title: 'Test Command' },
      load: vi.fn().mockResolvedValue(class {
        run = mockRun
      }),
    }

    const mockDeps = {} as CommandDependencies
    const handlers = registerLazyCommands({
      dependencies: mockDeps,
      entries: [mockEntry],
    })

    expect(handlers['test.command']).toBeDefined()
    const handler = handlers['test.command']
    if (handler) {
      await handler()
    }

    expect(mockEntry.load).toHaveBeenCalled()
    expect(mockRun).toHaveBeenCalledWith(mockDeps)
  })
})
