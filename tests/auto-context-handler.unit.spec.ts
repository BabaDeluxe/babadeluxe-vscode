import path from 'node:path'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'reactive-vscode'
import { ok, err } from 'neverthrow'
import { type Disposable, type TextDocument } from 'vscode'
import { AutoContextHandler } from '../src/auto-context-handler.js'
import type { RgContextBuilder } from '../src/rg-context-builder.js'
import type { Bm25IndexService } from '../src/bm25-index-service.js'
import { RgSearchError } from '../src/errors.js'

type MockTextEditor = Readonly<{
  document: Readonly<{ uri: Readonly<{ fsPath: string }> }>
}>

const testRootFsPath = '/test/root'
const maxResults = 120

const boostPoints = {
  active: 80,
  visible: 40,
  recent: 30,
  sameDir: 20,
} as const
const sharedGitRecencyByPath = {
  value: new Map<string, { timestampMs?: number; recencyScore: number }>(),
}

vi.mock('../src/use-git-recency-map.js', () => {
  return {
    useGitRecencyMap: () => ({
      gitRecencyByPath: sharedGitRecencyByPath,
      ensureRecencyFor: vi.fn(async (filePath: string) => {
        if (!sharedGitRecencyByPath.value.has(filePath)) {
          sharedGitRecencyByPath.value.set(filePath, { recencyScore: 0 })
        }
      }),
    }),
  }
})

describe('AutoContextHandler', () => {
  let mockRgBuilder: RgContextBuilder
  let mockBm25Service: Bm25IndexService
  let saveFileCallback: ((doc: TextDocument) => void) | undefined
  let activeEditorRef: ReturnType<typeof ref<MockTextEditor | undefined>>
  let visibleEditorsRef: ReturnType<typeof ref<MockTextEditor[]>>

  const createHandler = (): AutoContextHandler =>
    new AutoContextHandler(testRootFsPath, mockRgBuilder, mockBm25Service)

  const setActiveFile = (relativePath: string | undefined): void => {
    activeEditorRef.value = relativePath
      ? { document: { uri: { fsPath: path.join(testRootFsPath, relativePath) } } }
      : undefined
  }

  const setVisibleFiles = (relativePaths: readonly string[]): void => {
    visibleEditorsRef.value = relativePaths.map((relativePath) => ({
      document: { uri: { fsPath: path.join(testRootFsPath, relativePath) } },
    }))
  }

  const simulateSave = (fsPath: string): void => {
    if (!saveFileCallback) throw new Error('Save callback not initialized')
    saveFileCallback({ uri: { fsPath } } as unknown as TextDocument)
  }

  beforeEach(async () => {
    vi.clearAllMocks()
    activeEditorRef = ref<MockTextEditor | undefined>(undefined)
    visibleEditorsRef = ref<MockTextEditor[]>([])

    const { useActiveTextEditor, useVisibleTextEditors } = await import('reactive-vscode')
    vi.mocked(useActiveTextEditor).mockReturnValue(activeEditorRef as any)
    vi.mocked(useVisibleTextEditors).mockReturnValue(visibleEditorsRef as any)

    mockRgBuilder = {
      buildContext: vi.fn(),
    } as unknown as RgContextBuilder

    mockBm25Service = {
      searchAdaptiveCandidates: vi.fn(),
    } as unknown as Bm25IndexService

    const { workspace: vsWorkspace } = await import('vscode')
    vi.mocked(vsWorkspace.onDidSaveTextDocument).mockImplementation((listener) => {
      saveFileCallback = listener
      return { dispose: vi.fn() } as unknown as Disposable
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('rejects empty query', async () => {
    const handler = createHandler()
    const result = await handler.handleRequest('   ')
    expect(result.isErr()).toBe(true)
  })

  it('merges BM25 and RG results', async () => {
    vi.mocked(mockBm25Service.searchAdaptiveCandidates).mockReturnValue([
      { filePath: 'file1.ts', score: 100 },
      { filePath: 'file2.ts', score: 50 },
    ])

    vi.mocked(mockRgBuilder.buildContext).mockResolvedValue(
      ok([
        {
          file: 'file1.ts',
          score: 75,
          matchRange: { startLine: 0, startCharacter: 0, endLine: 0, endCharacter: 10 },
          matchedLineText: 'test line',
        },
        {
          file: 'file3.ts',
          score: 60,
          matchRange: { startLine: 5, startCharacter: 0, endLine: 5, endCharacter: 15 },
          matchedLineText: 'another test',
        },
      ])
    )

    const handler = createHandler()
    const result = await handler.handleRequest('test query')
    expect(result.isOk()).toBe(true)
    if (result.isErr()) return

    expect(result.value).toHaveLength(3)

    const file1 = result.value.find((item) => Boolean(item.filePath?.endsWith('file1.ts')))
    const file3 = result.value.find((item) => Boolean(item.filePath?.endsWith('file3.ts')))

    expect(file1?.score).toBeDefined()
    expect(file3?.matchRange).toBeDefined()
  })

  it('handles RG failure gracefully when BM25 has results', async () => {
    vi.mocked(mockBm25Service.searchAdaptiveCandidates).mockReturnValue([
      { filePath: 'file1.ts', score: 100 },
    ])

    vi.mocked(mockRgBuilder.buildContext).mockResolvedValue(err(new RgSearchError('RG failed')))

    const handler = createHandler()
    const result = await handler.handleRequest('test')
    expect(result.isOk()).toBe(true)
    if (result.isErr()) return

    expect(result.value).toHaveLength(1)
  })

  it('boosts active file by configured points', async () => {
    setActiveFile('active.ts')

    vi.mocked(mockBm25Service.searchAdaptiveCandidates).mockReturnValue([
      { filePath: 'active.ts', score: 50 },
      { filePath: 'other.ts', score: 50 },
    ])
    vi.mocked(mockRgBuilder.buildContext).mockResolvedValue(ok([]))

    const handler = createHandler()
    const result = await handler.handleRequest('test')
    expect(result.isOk()).toBe(true)
    if (result.isErr()) return

    const active = result.value.find((item) => Boolean(item.filePath?.endsWith('active.ts')))
    const other = result.value.find((item) => Boolean(item.filePath?.endsWith('other.ts')))

    expect((active?.score ?? 0) - (other?.score ?? 0)).toBe(boostPoints.active)
  })

  it('boosts visible file by configured points', async () => {
    setVisibleFiles(['visible.ts'])

    vi.mocked(mockBm25Service.searchAdaptiveCandidates).mockReturnValue([
      { filePath: 'visible.ts', score: 50 },
      { filePath: 'hidden.ts', score: 50 },
    ])
    vi.mocked(mockRgBuilder.buildContext).mockResolvedValue(ok([]))

    const handler = createHandler()
    const result = await handler.handleRequest('test')
    if (result.isErr()) throw result.error

    const visible = result.value.find((item) => Boolean(item.filePath?.endsWith('visible.ts')))
    const hidden = result.value.find((item) => Boolean(item.filePath?.endsWith('hidden.ts')))

    expect((visible?.score ?? 0) - (hidden?.score ?? 0)).toBe(boostPoints.visible)
  })

  it('boosts recently saved file by configured points', async () => {
    vi.mocked(mockBm25Service.searchAdaptiveCandidates).mockReturnValue([
      { filePath: 'recent.ts', score: 50 },
      { filePath: 'old.ts', score: 50 },
    ])
    vi.mocked(mockRgBuilder.buildContext).mockResolvedValue(ok([]))

    const handler = createHandler()

    simulateSave(path.join(testRootFsPath, 'recent.ts'))

    const result = await handler.handleRequest('test')
    if (result.isErr()) throw result.error

    const recent = result.value.find((item) => Boolean(item.filePath?.endsWith('recent.ts')))
    const old = result.value.find((item) => Boolean(item.filePath?.endsWith('old.ts')))

    expect((recent?.score ?? 0) - (old?.score ?? 0)).toBe(boostPoints.recent)
  })

  it(`caps results at ${maxResults}`, async () => {
    const manyFiles = Array.from({ length: 150 }, (_, index) => ({
      filePath: `file${index}.ts`,
      score: 200 - index,
    }))

    vi.mocked(mockBm25Service.searchAdaptiveCandidates).mockReturnValue(manyFiles)
    vi.mocked(mockRgBuilder.buildContext).mockResolvedValue(ok([]))

    const handler = createHandler()
    const result = await handler.handleRequest('test')
    if (result.isErr()) throw result.error

    expect(result.value).toHaveLength(maxResults)
  })

  it('boosts git-recent file by git recency points', async () => {
    vi.mocked(mockBm25Service.searchAdaptiveCandidates).mockReturnValue([
      { filePath: 'hot.ts', score: 50 },
      { filePath: 'cold.ts', score: 50 },
    ])
    vi.mocked(mockRgBuilder.buildContext).mockResolvedValue(ok([]))
    sharedGitRecencyByPath.value = new Map([
      [path.join(testRootFsPath, 'hot.ts'), { timestampMs: Date.now(), recencyScore: 1 }],
      [path.join(testRootFsPath, 'cold.ts'), { timestampMs: Date.now(), recencyScore: 0 }],
    ])

    const handler = createHandler()
    const result = await handler.handleRequest('test')
    if (result.isErr()) throw result.error

    const hot = result.value.find((item) => item.filePath?.endsWith('hot.ts'))
    const cold = result.value.find((item) => item.filePath?.endsWith('cold.ts'))

    expect(hot?.score).toBeDefined()
    expect(cold?.score).toBeDefined()
    expect((hot?.score ?? 0) - (cold?.score ?? 0)).toBeCloseTo(25)
  })
})
