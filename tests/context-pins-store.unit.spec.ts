/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-dynamic-delete */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { describe, it, expect, beforeEach } from 'vitest'
import type * as vscodeTypes from 'vscode'
import { ContextPinsStore } from '../src/context-pins-store.js'

const storageKeyV2 = 'babadeluxe.contextPins.snapshot.v2'
const globalRootKey = '__workspace_root__'

const createMockContext = () => {
  const store: Record<string, unknown> = {}

  const workspaceState: vscodeTypes.Memento = {
    get: (key: string, defaultValue?: unknown) => (key in store ? store[key] : defaultValue),
    async update(key: string, value: unknown) {
      if (value === undefined) delete store[key]
      else store[key] = value
    },
  } as any

  const extensionContext: vscodeTypes.ExtensionContext = {
    workspaceState,
  } as any

  return { extensionContext, getStore: () => store }
}

describe('ContextPinsStore', () => {
  let extensionContext: vscodeTypes.ExtensionContext
  let getStore: () => Record<string, unknown>
  let store: ContextPinsStore

  beforeEach(() => {
    const mock = createMockContext()
    extensionContext = mock.extensionContext
    getStore = mock.getStore
    store = new ContextPinsStore(extensionContext)
  })

  it('readSnapshot returns empty when state missing or wrong version', () => {
    const snapshot = store.readSnapshot(globalRootKey)

    expect(snapshot.type).toBe('context:snapshot')
    expect(snapshot.pinnedFiles).toEqual([])
    expect(snapshot.pinnedSnippets).toEqual([])
  })

  it('readSnapshot returns global root slice when present', async () => {
    await extensionContext.workspaceState.update(storageKeyV2, {
      version: 2,
      byRootKey: {
        [globalRootKey]: {
          pinnedFiles: [{ filePath: '/foo.ts' }],
          pinnedSnippets: [
            {
              id: '1',
              filePath: '/foo.ts',
              snippet: 'x',
              range: { startLine: 0, startCharacter: 0, endLine: 0, endCharacter: 1 },
            },
          ],
        },
      },
    })

    const snapshot = store.readSnapshot(globalRootKey)

    expect(snapshot.pinnedFiles).toEqual([{ filePath: '/foo.ts' }])
    expect(snapshot.pinnedSnippets).toHaveLength(1)
  })

  it('migrateLegacyToRoot does nothing when version is not v2', async () => {
    await extensionContext.workspaceState.update(storageKeyV2, { version: 1 })

    await store.migrateLegacyToRoot()

    const persisted = getStore()[storageKeyV2]
    expect(persisted).toEqual({ version: 1 })
  })

  it('migrateLegacyToRoot does nothing when global root already exists', async () => {
    await extensionContext.workspaceState.update(storageKeyV2, {
      version: 2,
      byRootKey: {
        [globalRootKey]: { pinnedFiles: [{ filePath: '/root.ts' }], pinnedSnippets: [] },
        '/other': { pinnedFiles: [{ filePath: '/other.ts' }], pinnedSnippets: [] },
      },
    })

    await store.migrateLegacyToRoot()

    const persisted = getStore()[storageKeyV2] as any
    expect(persisted.byRootKey[globalRootKey].pinnedFiles).toEqual([{ filePath: '/root.ts' }])
  })

  it('migrateLegacyToRoot picks slice with most pins as global root', async () => {
    await extensionContext.workspaceState.update(storageKeyV2, {
      version: 2,
      byRootKey: {
        '/a': {
          pinnedFiles: [{ filePath: '/a1.ts' }],
          pinnedSnippets: [],
        },
        '/b': {
          pinnedFiles: [{ filePath: '/b1.ts' }, { filePath: '/b2.ts' }],
          pinnedSnippets: [
            {
              id: '1',
              filePath: '/b3.ts',
              snippet: 'x',
              range: { startLine: 0, startCharacter: 0, endLine: 0, endCharacter: 1 },
            },
          ],
        },
      },
    })

    await store.migrateLegacyToRoot()

    const persisted = getStore()[storageKeyV2] as any
    const rootSlice = persisted.byRootKey[globalRootKey]

    expect(rootSlice.pinnedFiles).toHaveLength(2)
    expect(rootSlice.pinnedSnippets).toHaveLength(1)
  })

  it('clear empties global root slice', async () => {
    await extensionContext.workspaceState.update(storageKeyV2, {
      version: 2,
      byRootKey: {
        [globalRootKey]: {
          pinnedFiles: [{ filePath: '/a.ts' }],
          pinnedSnippets: [
            {
              id: '1',
              filePath: '/a.ts',
              snippet: 'x',
              range: { startLine: 0, startCharacter: 0, endLine: 0, endCharacter: 1 },
            },
          ],
        },
      },
    })

    await store.clear(globalRootKey)

    const persisted = getStore()[storageKeyV2] as any
    const slice = persisted.byRootKey[globalRootKey]
    expect(slice.pinnedFiles).toEqual([])
    expect(slice.pinnedSnippets).toEqual([])
  })

  it('unpinByFilePath removes pins for normalized file path', async () => {
    await extensionContext.workspaceState.update(storageKeyV2, {
      version: 2,
      byRootKey: {
        [globalRootKey]: {
          pinnedFiles: [
            { filePath: String.raw`C:\Project\File.ts` },
            { filePath: String.raw`C:\Project\Other.ts` },
          ],
          pinnedSnippets: [
            {
              id: '1',
              filePath: String.raw`C:\Project\File.ts`,
              snippet: 'x',
              range: { startLine: 0, startCharacter: 0, endLine: 0, endCharacter: 1 },
            },
          ],
        },
      },
    })

    await store.unpinByFilePath(globalRootKey, 'c:/project/file.ts')

    const persisted = getStore()[storageKeyV2] as any
    const slice = persisted.byRootKey[globalRootKey]
    expect(slice.pinnedFiles.map((p: any) => p.filePath)).toEqual([String.raw`C:\Project\Other.ts`])
    expect(slice.pinnedSnippets).toEqual([])
  })

  it('upsertFilePin inserts new pin and removes snippets for that file', async () => {
    await extensionContext.workspaceState.update(storageKeyV2, {
      version: 2,
      byRootKey: {
        [globalRootKey]: {
          pinnedFiles: [],
          pinnedSnippets: [
            {
              id: '1',
              filePath: '/path/file.ts',
              snippet: 'old',
              range: { startLine: 0, startCharacter: 0, endLine: 0, endCharacter: 1 },
            },
          ],
        },
      },
    })

    await store.upsertFilePin(globalRootKey, ' /path/file.ts ')

    const persisted = getStore()[storageKeyV2] as any
    const slice = persisted.byRootKey[globalRootKey]
    expect(slice.pinnedFiles).toHaveLength(1)
    expect(slice.pinnedFiles[0].filePath).toBe('/path/file.ts')
    expect(slice.pinnedSnippets).toEqual([])
  })

  it('upsertSnippetPin updates existing file pin range and clears snippets for that file', async () => {
    await extensionContext.workspaceState.update(storageKeyV2, {
      version: 2,
      byRootKey: {
        [globalRootKey]: {
          pinnedFiles: [
            {
              filePath: '/path/file.ts',
              range: { startLine: 1, startCharacter: 0, endLine: 2, endCharacter: 0 },
            },
          ],
          pinnedSnippets: [
            {
              id: '1',
              filePath: '/path/file.ts',
              snippet: 'old',
              range: { startLine: 0, startCharacter: 0, endLine: 0, endCharacter: 1 },
            },
          ],
        },
      },
    })

    await store.upsertSnippetPin(globalRootKey, {
      id: '2',
      filePath: ' /path/file.ts ',
      snippet: ' new ',
      range: { startLine: 10, startCharacter: 0, endLine: 20, endCharacter: 0 },
    })

    const persisted = getStore()[storageKeyV2] as any
    const slice = persisted.byRootKey[globalRootKey]
    expect(slice.pinnedFiles[0].range).toEqual({
      startLine: 10,
      startCharacter: 0,
      endLine: 20,
      endCharacter: 0,
    })
    expect(slice.pinnedSnippets).toEqual([])
  })

  it('upsertSnippetPin inserts snippet when no existing file pin', async () => {
    await extensionContext.workspaceState.update(storageKeyV2, {
      version: 2,
      byRootKey: {
        [globalRootKey]: {
          pinnedFiles: [],
          pinnedSnippets: [],
        },
      },
    })

    await store.upsertSnippetPin(globalRootKey, {
      id: '1',
      filePath: ' /path/file.ts ',
      snippet: '  hello  ',
      range: { startLine: 0, startCharacter: 0, endLine: 5, endCharacter: 0 },
    })

    const persisted = getStore()[storageKeyV2] as any
    const slice = persisted.byRootKey[globalRootKey]
    expect(slice.pinnedFiles).toEqual([])
    expect(slice.pinnedSnippets).toHaveLength(1)
    expect(slice.pinnedSnippets[0].filePath).toBe('/path/file.ts')
    expect(slice.pinnedSnippets[0].snippet).toBe('hello')
  })

  it('upsertSnippetPin merges overlapping snippets into envelope', async () => {
    await extensionContext.workspaceState.update(storageKeyV2, {
      version: 2,
      byRootKey: {
        [globalRootKey]: {
          pinnedFiles: [],
          pinnedSnippets: [
            {
              id: '1',
              filePath: '/path/file.ts',
              snippet: 'old',
              range: { startLine: 0, startCharacter: 0, endLine: 0, endCharacter: 20 },
            },
          ],
        },
      },
    })

    await store.upsertSnippetPin(globalRootKey, {
      id: '2',
      filePath: '/path/file.ts',
      snippet: 'new',
      range: { startLine: 0, startCharacter: 5, endLine: 0, endCharacter: 15 },
    })

    const persisted = getStore()[storageKeyV2] as any
    const slice = persisted.byRootKey[globalRootKey]

    const snippetsForFile = slice.pinnedSnippets.filter((p: any) => p.filePath === '/path/file.ts')

    expect(snippetsForFile).toHaveLength(1)

    expect(snippetsForFile[0].range).toEqual({
      startLine: 0,
      startCharacter: 0,
      endLine: 0,
      endCharacter: 20,
    })

    expect(snippetsForFile[0].id).toBe('1')

    expect(snippetsForFile[0].snippet).toBe('new')
  })

  it('upsertSnippetPin expands envelope when new snippet is wider', async () => {
    await extensionContext.workspaceState.update(storageKeyV2, {
      version: 2,
      byRootKey: {
        [globalRootKey]: {
          pinnedFiles: [],
          pinnedSnippets: [
            {
              id: '1',
              filePath: '/path/file.ts',
              snippet: 'old',
              range: { startLine: 0, startCharacter: 5, endLine: 0, endCharacter: 10 },
            },
          ],
        },
      },
    })

    await store.upsertSnippetPin(globalRootKey, {
      id: '2',
      filePath: '/path/file.ts',
      snippet: 'new',
      range: { startLine: 0, startCharacter: 0, endLine: 0, endCharacter: 20 },
    })

    const persisted = getStore()[storageKeyV2] as any
    const slice = persisted.byRootKey[globalRootKey]
    const snippetsForFile = slice.pinnedSnippets.filter((p: any) => p.filePath === '/path/file.ts')

    expect(snippetsForFile).toHaveLength(1)

    expect(snippetsForFile[0].range).toEqual({
      startLine: 0,
      startCharacter: 0,
      endLine: 0,
      endCharacter: 20,
    })

    expect(snippetsForFile[0].id).toBe('1')

    expect(snippetsForFile[0].snippet).toBe('new')
  })

  it('upsertSnippetPin keeps non-overlapping snippets separate', async () => {
    await extensionContext.workspaceState.update(storageKeyV2, {
      version: 2,
      byRootKey: {
        [globalRootKey]: {
          pinnedFiles: [],
          pinnedSnippets: [
            {
              id: '1',
              filePath: '/path/file.ts',
              snippet: 'first',
              range: { startLine: 0, startCharacter: 0, endLine: 0, endCharacter: 5 },
            },
          ],
        },
      },
    })

    await store.upsertSnippetPin(globalRootKey, {
      id: '2',
      filePath: '/path/file.ts',
      snippet: 'second',
      range: { startLine: 0, startCharacter: 10, endLine: 0, endCharacter: 15 },
    })

    const persisted = getStore()[storageKeyV2] as any
    const slice = persisted.byRootKey[globalRootKey]
    const snippetsForFile = slice.pinnedSnippets.filter((p: any) => p.filePath === '/path/file.ts')

    expect(snippetsForFile).toHaveLength(2)
    expect(snippetsForFile.map((s: any) => s.id).sort()).toEqual(['1', '2'])
  })
})
