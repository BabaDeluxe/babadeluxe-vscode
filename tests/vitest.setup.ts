import { createVSCodeMock } from 'jest-mock-vscode'
import { vi } from 'vitest'

vi.mock('vscode', () => createVSCodeMock(vi))
