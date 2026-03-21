import { describe, expect, it, vi, beforeEach } from 'vitest'
import * as vscode from 'vscode'
import { Bm25IndexService } from '../../src/bm25/service.js'
import { ok } from 'neverthrow'

vi.mock('vscode', () => ({
  Uri: {
    file: vi.fn((path) => ({ fsPath: path })),
    joinPath: vi.fn((uri, ...parts) => ({ fsPath: `${uri.fsPath}/${parts.join('/')}` })),
  },
  workspace: {
    fs: {
      readFile: vi.fn(),
      writeFile: vi.fn(),
      createDirectory: vi.fn(),
    },
  },
}))

vi.mock('../../src/bm25/storage.js', () => ({
  IndexStorage: vi.fn().mockImplementation(() => ({
    getIsAvailable: vi.fn().mockReturnValue(true),
    getIndexDirectoryUri: vi.fn().mockReturnValue({ fsPath: '/mock/storage' }),
    readJsonFile: vi.fn().mockResolvedValue(null),
    writeJsonFile: vi.fn().mockResolvedValue(undefined),
  })),
}))

vi.mock('../../s../rg/file-lister.js', () => ({
  listIndexableFiles: vi.fn().mockResolvedValue(ok(['file1.ts', 'file2.ts'])),
}))

describe('Bm25IndexService', () => {
  let service: Bm25IndexService
  let mockContext: vscode.ExtensionContext

  beforeEach(() => {
    mockContext = {
      globalStorageUri: { fsPath: '/global/storage' },
      storageUri: { fsPath: '/workspace/storage' },
    } as unknown as vscode.ExtensionContext
    service = new Bm25IndexService(mockContext, '/workspace/root')
  })

  it('initializes correctly', () => {
    expect(service).toBeDefined()
  })

  it('searches adaptive candidates returns empty if not built', () => {
    const results = service.searchAdaptiveCandidates('test')
    expect(results).toEqual([])
  })
})
