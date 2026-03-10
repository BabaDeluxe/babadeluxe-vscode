/* eslint-disable @typescript-eslint/naming-convention */
import { vi } from 'vitest'

const vscode = {
  workspace: {
    onDidChangeTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
    onDidSaveTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
    fs: {
      readFile: vi.fn(),
    },
  },
  window: {
    activeTextEditor: undefined,
    visibleTextEditors: [],
  },
  extensions: {
    getExtension: vi.fn().mockReturnValue(undefined),
  },
  env: {
    asExternalUri: vi.fn(async (uri: unknown) => uri),
  },
  Uri: {
    file: (path: string) => ({ fsPath: path }),
  },
  commands: {
    executeCommand: vi.fn(),
  },
}

export default vscode
export const { workspace, window, Uri, commands, env, extensions } = vscode
