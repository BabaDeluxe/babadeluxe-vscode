/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { createVSCodeMock } from 'jest-mock-vscode'
import { vi } from 'vitest'

const baseMock = createVSCodeMock(vi) as any

const vscode = {
  ...baseMock,
  workspace: {
    ...baseMock.workspace,
    onDidSaveTextDocument: vi.fn(() => ({
      dispose: vi.fn(),
    })),
    fs: {
      readFile: vi.fn(),
    },
  },
  env: {
    ...baseMock.env,
    asExternalUri: vi.fn(async (uri: unknown) => uri),
  },
  // eslint-disable-next-line @typescript-eslint/naming-convention
  Uri: {
    file: (path: string) => ({ fsPath: path }),
    ...baseMock.Uri,
  },
}

export default vscode
// eslint-disable-next-line @typescript-eslint/naming-convention
export const { workspace, window, Uri, commands, env } = vscode
