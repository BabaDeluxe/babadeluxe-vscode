import { vi } from 'vitest'

vi.mock('../src/logger.js', () => ({
  logger: {
    log: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

vi.mock('reactive-vscode', async () => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const actual = await vi.importActual<typeof import('reactive-vscode')>('reactive-vscode')

  return {
    ...actual,
    useActiveTextEditor: vi.fn(),
    useVisibleTextEditors: vi.fn(),
    useDisposable: vi.fn(<T>(disposable: T) => disposable),
    onScopeDispose: vi.fn(),
  }
})
