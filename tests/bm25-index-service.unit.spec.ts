/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'
import type * as vscodeTypes from 'vscode'
import { ok } from 'neverthrow'
import { Bm25IndexService } from '../src/bm25-index-service.js'
import { Bm25IndexConsolidationError, FileReadError } from '../src/errors.js'
import { pickAdaptiveScoredCandidates } from '../src/adaptive-candidates.js'

// Stub modules
vi.mock('wink-bm25-text-search', () => {
  const engine = {
    defineConfig: vi.fn(),
    definePrepTasks: vi.fn(),
    importJSON: vi.fn(),
    exportJSON: vi.fn().mockReturnValue({ exported: true }),
    search: vi.fn(),
    addDoc: vi.fn(),
    consolidate: vi.fn(),
  }

  return {
    default: vi.fn(() => engine),
  }
})

vi.mock('../src/adaptive-candidates.js', () => ({
  pickAdaptiveScoredCandidates: vi.fn((scored) => scored),
}))

vi.mock('../src/index-storage.js', () => {
  const getIsAvailable = vi.fn(() => true)
  const getIndexDirectoryUri = vi.fn((root: string) => ({ root }) as any)
  const readJsonFile = vi.fn()
  const writeJsonFile = vi.fn()

  const IndexStorage = vi.fn().mockImplementation(() => ({
    getIsAvailable,
    getIndexDirectoryUri,
    readJsonFile,
    writeJsonFile,
  }))

  return { IndexStorage }
})

vi.mock('../src/rg-file-lister.js', () => ({
  listIndexableFiles: vi.fn(),
}))

vi.mock('../src/search-term-extractor.js', () => ({
  extractSearchTerms: vi.fn((text: string) => [{ kind: 'token', value: text.toLowerCase() }]),
}))

vi.mock('../src/logger.js', () => ({
  logger: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

describe('Bm25IndexService', () => {
  let context: vscodeTypes.ExtensionContext
  const root = '/test/root'

  beforeEach(() => {
    vi.clearAllMocks()
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    context = {} as vscodeTypes.ExtensionContext
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const createService = () => new Bm25IndexService(context, root)

  it('searchAdaptiveCandidates returns empty when engine not built', () => {
    const service = createService()
    const result = service.searchAdaptiveCandidates('test query')
    expect(result).toEqual([])
    expect(pickAdaptiveScoredCandidates).toHaveBeenCalledWith([])
  })

  it('searchAdaptiveCandidates maps engine results to scored candidates', async () => {
    const bm25Module = await import('wink-bm25-text-search')
    const bm25Factory = bm25Module.default as unknown as Mock
    const engine = bm25Factory()

    engine.search.mockReturnValue([
      [0, 1],
      [1, 0.5],
      [2, 0.25],
    ])

    const service = createService()
    ;(service as any)._engine = engine
    ;(service as any)._idToPath = ['file0.ts', 'file1.ts', 'file2.ts']

    const result = service.searchAdaptiveCandidates('test')
    expect(result).toEqual([
      { filePath: 'file0.ts', score: 1 },
      { filePath: 'file1.ts', score: 0.5 },
      { filePath: 'file2.ts', score: 0.25 },
    ])
    expect(pickAdaptiveScoredCandidates).toHaveBeenCalledWith(result)
  })

  it('searchAdaptiveCandidates skips results with missing idToPath entries', async () => {
    const bm25Module = await import('wink-bm25-text-search')
    const bm25Factory = bm25Module.default as unknown as Mock
    const engine = bm25Factory()

    engine.search.mockReturnValue([
      [0, 1],
      [1, 0.5],
      [3, 0.25],
    ])

    const service = createService()
    ;(service as any)._engine = engine
    ;(service as any)._idToPath = ['file0.ts', 'file1.ts']

    const result = service.searchAdaptiveCandidates('test')
    expect(result).toEqual([
      { filePath: 'file0.ts', score: 1 },
      { filePath: 'file1.ts', score: 0.5 },
    ])
  })

  it('loadCacheIfPossible returns ok when storage is unavailable', async () => {
    const { IndexStorage } = await import('../src/index-storage.js')
    ;(IndexStorage as any).mockImplementationOnce(() => ({
      getIsAvailable: () => false,
    }))

    const service = createService()
    const result = await service.loadCacheIfPossible()
    expect(result.isOk()).toBe(true)
    expect((service as any)._engine).toBeUndefined()
  })

  it('loadCacheIfPossible loads engine and idToPath when cache present and valid', async () => {
    const { IndexStorage } = await import('../src/index-storage.js')
    const engineJson = { some: 'engine' }
    const idToPathJson = JSON.stringify(['file0.ts', 'file1.ts'])

    ;(IndexStorage as any).mockImplementationOnce(() => ({
      getIsAvailable: () => true,
      getIndexDirectoryUri: () => ({ root }) as any,
      readJsonFile: vi.fn().mockResolvedValueOnce(engineJson).mockResolvedValueOnce(idToPathJson),
    }))

    const bm25Module = await import('wink-bm25-text-search')
    const bm25Factory = bm25Module.default as unknown as Mock
    const engine = bm25Factory()

    const service = createService()
    const result = await service.loadCacheIfPossible()

    expect(result.isOk()).toBe(true)
    expect(engine.defineConfig).toHaveBeenCalled()
    expect(engine.definePrepTasks).toHaveBeenCalled()
    expect(engine.importJSON).toHaveBeenCalledWith(engineJson)
    expect((service as any)._idToPath).toEqual(['file0.ts', 'file1.ts'])
    expect((service as any)._engine).toBe(engine)
  })

  it('buildFreshEngine fails when too few files', async () => {
    const { listIndexableFiles } = await import('../src/rg-file-lister.js')
    ;(listIndexableFiles as any).mockResolvedValueOnce(ok(['/file1.ts']))

    const service = createService()
    const result = await (service as any)._buildFreshEngine()

    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(Bm25IndexConsolidationError)
  })

  it('readAndIndexFile returns FileReadError when read fails', async () => {
    const vscode = await import('vscode')

    vi.spyOn(vscode.workspace.fs, 'readFile').mockRejectedValueOnce(new Error('boom'))

    const bm25Module = await import('wink-bm25-text-search')
    const bm25Factory = bm25Module.default as unknown as Mock
    const engine = bm25Factory()

    const service = createService()
    const result = await (service as any)._readAndIndexFile('/path/file.ts', engine, 0)

    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(FileReadError)
    expect(engine.addDoc).not.toHaveBeenCalled()
  })

  it('readAndIndexFile adds doc with capped content', async () => {
    const vscode = await import('vscode')
    const longContent = 'a'.repeat(60_000)

    vi.spyOn(vscode.workspace.fs, 'readFile').mockResolvedValueOnce(
      new TextEncoder().encode(longContent)
    )

    const bm25Module = await import('wink-bm25-text-search')
    const bm25Factory = bm25Module.default as unknown as Mock
    const engine = bm25Factory()

    const service = createService()
    const result = await (service as any)._readAndIndexFile('/path/file.ts', engine, 42)

    expect(result.isOk()).toBe(true)
    expect(engine.addDoc).toHaveBeenCalledTimes(1)
    const [doc, id] = engine.addDoc.mock.calls[0]
    expect(id).toBe(42)
    expect(doc.path).toBe('/path/file.ts')
    expect((doc.content as string).length).toBe(50_000)
  })
})
