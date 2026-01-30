import process from 'node:process'
import type * as vscode from 'vscode'
import type { ContextSnapshotMessage, UiTextRange } from './types.js'

type StoredFilePin = Readonly<{ filePath: string; range?: UiTextRange }>
type StoredSnippetPin = Readonly<{
  id: string
  filePath: string
  snippet: string
  range: UiTextRange
}>

type PersistedStateV1 = Readonly<{
  version: 1
  pinnedFiles: StoredFilePin[]
  pinnedSnippets: StoredSnippetPin[]
}>

const storageKey = 'babadeluxe.contextPins.snapshot.v1'

const normalizeFsPath = (filePath: string): string => {
  const normalized = filePath.replaceAll('\\', '/')
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized
}

export class ContextPinsStore {
  public constructor(private readonly _context: vscode.ExtensionContext) {}

  public readSnapshot(): ContextSnapshotMessage {
    const state = this._context.workspaceState.get<PersistedStateV1>(storageKey)

    if (state?.version !== 1) {
      return { type: 'context:snapshot', pinnedFiles: [], pinnedSnippets: [] }
    }

    return {
      type: 'context:snapshot',
      pinnedFiles: state.pinnedFiles,
      pinnedSnippets: state.pinnedSnippets,
    }
  }

  public async clear(): Promise<void> {
    const next: PersistedStateV1 = { version: 1, pinnedFiles: [], pinnedSnippets: [] }
    await this._context.workspaceState.update(storageKey, next)
  }

  public async unpinByFilePath(filePath: string): Promise<void> {
    const cleaned = filePath.trim()
    if (!cleaned) return
    const key = normalizeFsPath(cleaned)

    const snapshot = this.readSnapshot()
    const pinnedFiles = snapshot.pinnedFiles.filter((p) => normalizeFsPath(p.filePath) !== key)
    const pinnedSnippets = snapshot.pinnedSnippets.filter(
      (p) => normalizeFsPath(p.filePath) !== key
    )

    const next: PersistedStateV1 = { version: 1, pinnedFiles, pinnedSnippets }
    await this._context.workspaceState.update(storageKey, next)
  }

  public async upsertFilePin(filePath: string, range?: UiTextRange): Promise<void> {
    const cleaned = filePath.trim()
    if (!cleaned) return
    const key = normalizeFsPath(cleaned)

    const snapshot = this.readSnapshot()

    const pinnedSnippets = snapshot.pinnedSnippets.filter(
      (p) => normalizeFsPath(p.filePath) !== key
    )

    const pinnedFilesWithout = snapshot.pinnedFiles.filter(
      (p) => normalizeFsPath(p.filePath) !== key
    )
    const existing = snapshot.pinnedFiles.find((p) => normalizeFsPath(p.filePath) === key)

    const pinnedFiles: StoredFilePin[] = [
      { filePath: cleaned, range: existing?.range ?? range },
      ...pinnedFilesWithout,
    ]

    const next: PersistedStateV1 = { version: 1, pinnedFiles, pinnedSnippets }
    await this._context.workspaceState.update(storageKey, next)
  }

  public async upsertSnippetPin(pin: StoredSnippetPin): Promise<void> {
    const cleanedPath = pin.filePath.trim()
    const cleanedSnippet = pin.snippet.trim()
    if (!cleanedPath || !cleanedSnippet) return

    const key = normalizeFsPath(cleanedPath)
    const snapshot = this.readSnapshot()

    // If full file pinned, keep file pin and only update its range.
    const existingFile = snapshot.pinnedFiles.find((p) => normalizeFsPath(p.filePath) === key)
    if (existingFile) {
      const pinnedFilesWithout = snapshot.pinnedFiles.filter(
        (p) => normalizeFsPath(p.filePath) !== key
      )
      const pinnedFiles: StoredFilePin[] = [
        { ...existingFile, range: pin.range ?? existingFile.range },
        ...pinnedFilesWithout,
      ]

      const pinnedSnippets = snapshot.pinnedSnippets.filter(
        (p) => normalizeFsPath(p.filePath) !== key
      )
      const next: PersistedStateV1 = { version: 1, pinnedFiles, pinnedSnippets }
      await this._context.workspaceState.update(storageKey, next)
      return
    }

    const { pinnedFiles } = snapshot
    const pinnedSnippetsWithout = snapshot.pinnedSnippets.filter(
      (p) => normalizeFsPath(p.filePath) !== key
    )

    const pinnedSnippets: StoredSnippetPin[] = [
      { ...pin, filePath: cleanedPath, snippet: cleanedSnippet },
      ...pinnedSnippetsWithout,
    ]

    const next: PersistedStateV1 = { version: 1, pinnedFiles, pinnedSnippets }
    await this._context.workspaceState.update(storageKey, next)
  }
}
