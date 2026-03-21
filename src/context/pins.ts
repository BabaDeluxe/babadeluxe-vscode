import type * as vscode from 'vscode'
import { normalizeFileKey, normalizeFsPath } from './storage.js'
import { ContextPinsStoreError } from './errors.js'

const storageKeyV2 = 'babadeluxe.contextPins.snapshot.v2'
const globalRootKey = '__workspace_root__'

export type UiTextRange = {
  startLine: number
  startCharacter: number
  endLine: number
  endCharacter: number
}

export type StoredFilePin = {
  id: string
  filePath: string
  range?: UiTextRange
}

export type StoredSnippetPin = {
  id: string
  filePath: string
  snippet: string
  range: UiTextRange
}

type RootSlice = {
  pinnedFiles: StoredFilePin[]
  pinnedSnippets: StoredSnippetPin[]
}

type StorageModelV2 = {
  version: 2
  byRootKey: Record<string, RootSlice>
}

type StorageModel = StorageModelV2

type Position = { line: number; character: number }

function getInitialSlice(): RootSlice {
  return {
    pinnedFiles: [],
    pinnedSnippets: [],
  }
}

function comparePosition(a: Position, b: Position): number {
  if (a.line !== b.line) return a.line - b.line
  return a.character - b.character
}

function rangeStart(range: UiTextRange): Position {
  return { line: range.startLine, character: range.startCharacter }
}

function rangeEnd(range: UiTextRange): Position {
  return { line: range.endLine, character: range.endCharacter }
}

function rangesOverlap(a: UiTextRange, b: UiTextRange): boolean {
  return (
    comparePosition(rangeStart(a), rangeEnd(b)) < 0 &&
    comparePosition(rangeStart(b), rangeEnd(a)) < 0
  )
}

function computeMergedSnippet(
  snippets: StoredSnippetPin[],
  fileKey: string,
  newPin: StoredSnippetPin
): { toKeep: StoredSnippetPin[]; merged: StoredSnippetPin | undefined } {
  const overlapping: StoredSnippetPin[] = []
  const nonOverlapping: StoredSnippetPin[] = []

  for (const snippet of snippets) {
    if (normalizeFileKey(snippet.filePath) !== fileKey) {
      nonOverlapping.push(snippet)
      continue
    }

    if (rangesOverlap(snippet.range, newPin.range)) {
      overlapping.push(snippet)
    } else {
      nonOverlapping.push(snippet)
    }
  }

  if (overlapping.length === 0) {
    return { toKeep: snippets, merged: undefined }
  }

  // Compute union envelope
  let minStart = rangeStart(newPin.range)
  let maxEnd = rangeEnd(newPin.range)

  for (const snippet of overlapping) {
    const start = rangeStart(snippet.range)
    const end = rangeEnd(snippet.range)

    if (comparePosition(start, minStart) < 0) minStart = start
    if (comparePosition(end, maxEnd) > 0) maxEnd = end
  }

  const mergedRange: UiTextRange = {
    startLine: minStart.line,
    startCharacter: minStart.character,
    endLine: maxEnd.line,
    endCharacter: maxEnd.character,
  }

  const oldestSnippet = overlapping[0]
  if (!oldestSnippet) {
    // This should never happen due to length check above, but satisfy TS
    throw new ContextPinsStoreError('computeMergedSnippet: overlapping array unexpectedly empty')
  }

  const merged: StoredSnippetPin = {
    id: oldestSnippet.id,
    filePath: newPin.filePath,
    snippet: newPin.snippet,
    range: mergedRange,
  }

  return { toKeep: nonOverlapping, merged }
}

export class ContextPinsStore {
  constructor(private readonly _context: vscode.ExtensionContext) {}

  // Update signature: workspaceFolderFsPath → canonicalRootKey
  readSnapshot(canonicalRootKey: string) {
    const stored = this._getModel()
    const slice = (stored as StorageModelV2).byRootKey?.[canonicalRootKey] ?? getInitialSlice()

    return {
      type: 'context:snapshot',
      pinnedFiles: slice.pinnedFiles.map((p) => ({
        id: p.id,
        filePath: p.filePath,
        range: p.range,
      })),
      pinnedSnippets: slice.pinnedSnippets.map((s) => ({
        id: s.id,
        filePath: s.filePath,
        snippet: s.snippet,
        range: s.range,
      })),
    } as const
  }

  async migrateLegacyToRoot(): Promise<void> {
    const stored = this._getModel()

    if ((stored as any).version !== 2) {
      return
    }

    const model = stored as StorageModelV2

    if (model.byRootKey[globalRootKey]) {
      await this._context.workspaceState.update(storageKeyV2, model)
      return
    }

    const entries = Object.entries(model.byRootKey)
    if (entries.length === 0) {
      await this._context.workspaceState.update(storageKeyV2, model)
      return
    }

    let bestKey: string | undefined
    let bestSlice: RootSlice | undefined
    let bestCount = -1

    for (const [key, slice] of entries) {
      const count = slice.pinnedFiles.length + slice.pinnedSnippets.length
      if (count > bestCount) {
        bestKey = key
        bestSlice = slice
        bestCount = count
      }
    }

    if (!bestKey || !bestSlice) {
      await this._context.workspaceState.update(storageKeyV2, model)
      return
    }

    const next: StorageModelV2 = {
      ...model,
      byRootKey: {
        ...model.byRootKey,
        [globalRootKey]: bestSlice,
      },
    }

    await this._context.workspaceState.update(storageKeyV2, next)
  }

  async clear(canonicalRootKey: string): Promise<void> {
    const stored = this._getModel()
    const model = stored as StorageModelV2

    const next: StorageModelV2 = {
      ...model,
      byRootKey: {
        ...model.byRootKey,
        [canonicalRootKey]: getInitialSlice(),
      },
    }

    await this._context.workspaceState.update(storageKeyV2, next)
  }

  async unpinByFilePath(canonicalRootKey: string, filePath: string): Promise<void> {
    const cleanedPath = normalizeFsPath(filePath)
    if (!cleanedPath) {
      throw new ContextPinsStoreError('unpinByFilePath: filePath is required')
    }

    const stored = this._getModel()
    const model = stored as StorageModelV2
    const slice = model.byRootKey[canonicalRootKey] ?? getInitialSlice()

    const fileKey = normalizeFileKey(cleanedPath)

    const pinnedFiles = slice.pinnedFiles.filter((p) => normalizeFileKey(p.filePath) !== fileKey)
    const pinnedSnippets = slice.pinnedSnippets.filter(
      (p) => normalizeFileKey(p.filePath) !== fileKey
    )

    const next: StorageModelV2 = {
      ...model,
      byRootKey: {
        ...model.byRootKey,
        [canonicalRootKey]: { pinnedFiles, pinnedSnippets },
      },
    }

    await this._context.workspaceState.update(storageKeyV2, next)
  }

  async upsertFilePin(
    canonicalRootKey: string,
    filePath: string,
    range?: UiTextRange
  ): Promise<void> {
    const cleanedPath = normalizeFsPath(filePath)
    if (!cleanedPath) {
      throw new ContextPinsStoreError('upsertFilePin: filePath is required')
    }

    const stored = this._getModel()
    const model = stored as StorageModelV2
    const slice = model.byRootKey[canonicalRootKey] ?? getInitialSlice()

    const fileKey = normalizeFileKey(cleanedPath)

    const existingIndex = slice.pinnedFiles.findIndex(
      (p) => normalizeFileKey(p.filePath) === fileKey
    )

    let pinnedFiles: StoredFilePin[]
    if (existingIndex === -1) {
      const newPin: StoredFilePin = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        filePath: cleanedPath,
        range,
      }
      pinnedFiles = [newPin, ...slice.pinnedFiles]
    } else {
      const existing = slice.pinnedFiles[existingIndex]
      if (!existing) {
        throw new ContextPinsStoreError('upsertFilePin: existing pin not found for computed index')
      }

      const updated: StoredFilePin = { id: existing.id, filePath: cleanedPath, range }
      pinnedFiles = [updated, ...slice.pinnedFiles.filter((_, index) => index !== existingIndex)]
    }

    const pinnedSnippets = slice.pinnedSnippets.filter(
      (p) => normalizeFileKey(p.filePath) !== fileKey
    )

    const next: StorageModelV2 = {
      ...model,
      byRootKey: {
        ...model.byRootKey,
        [canonicalRootKey]: { pinnedFiles, pinnedSnippets },
      },
    }

    await this._context.workspaceState.update(storageKeyV2, next)
  }

  async upsertSnippetPin(
    canonicalRootKey: string,
    pin: Omit<StoredSnippetPin, 'filePath' | 'snippet'> & { filePath: string; snippet: string }
  ): Promise<void> {
    const cleanedPath = normalizeFsPath(pin.filePath)
    if (!cleanedPath) {
      throw new ContextPinsStoreError('upsertSnippetPin: filePath is required')
    }

    const cleanedSnippet = pin.snippet.trim()

    const stored = this._getModel()
    const model = stored as StorageModelV2
    const slice = model.byRootKey[canonicalRootKey] ?? getInitialSlice()

    const fileKey = normalizeFileKey(cleanedPath)

    const hasFilePinIndex = slice.pinnedFiles.findIndex(
      (p) => normalizeFileKey(p.filePath) === fileKey
    )

    let { pinnedFiles } = slice
    let pinnedSnippets: StoredSnippetPin[]

    if (hasFilePinIndex === -1) {
      // Case B: no file pin → multi snippet + overlap trimming
      const newSnippet: StoredSnippetPin = {
        ...pin,
        filePath: cleanedPath,
        snippet: cleanedSnippet,
      }

      const { toKeep, merged } = computeMergedSnippet(slice.pinnedSnippets, fileKey, newSnippet)

      pinnedSnippets = merged ? [merged, ...toKeep] : [newSnippet, ...toKeep]
    } else {
      // Case A: update existing file pin range, clear snippets for that file
      const existing = slice.pinnedFiles[hasFilePinIndex]
      if (!existing) {
        throw new ContextPinsStoreError(
          'upsertSnippetPin: existing file pin not found for computed index'
        )
      }

      const updated: StoredFilePin = {
        id: existing.id,
        filePath: cleanedPath,
        range: pin.range,
      }
      pinnedFiles = [updated, ...slice.pinnedFiles.filter((_, index) => index !== hasFilePinIndex)]

      pinnedSnippets = slice.pinnedSnippets.filter((p) => normalizeFileKey(p.filePath) !== fileKey)
    }

    const next: StorageModelV2 = {
      ...model,
      byRootKey: {
        ...model.byRootKey,
        [canonicalRootKey]: {
          pinnedFiles,
          pinnedSnippets,
        },
      },
    }

    await this._context.workspaceState.update(storageKeyV2, next)
  }

  private _getModel(): StorageModelV2 | { version: unknown } {
    const value = this._context.workspaceState.get(storageKeyV2)
    const model = value as StorageModel | { version: unknown } | undefined

    if (!model || (model as any).version === undefined) {
      return { version: 2, byRootKey: {} }
    }

    if ((model as any).version !== 2) {
      return model
    }

    return model
  }
}
