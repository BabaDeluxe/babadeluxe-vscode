import type * as vscode from 'vscode'
// @ts-expect-error No declaration file
import { type WinkBm25Engine } from 'wink-bm25-text-search'
import type { Bm25IndexService } from './bm25-index-service.js'
import type { Bm25RebuildQueue } from './bm25-rebuild-queue.js'

export type Role = 'user' | 'assistant' | 'system'

export type ContextItem = {
  readonly type: 'file' | 'note'
  readonly source?: 'rg' | 'manual'
  readonly filePath?: string
  readonly content: string
}

export type FileSignals = {
  readonly isActive: boolean
  readonly isOpen: boolean
  readonly wasEditedThisSession: boolean
  readonly sameDirAsActive: boolean
  readonly importsActive: boolean
  readonly importedByActive: boolean
  readonly recentlyTouchedInGit: boolean
}

export type UiContextItem = {
  readonly id: string
  readonly kind: 'auto' | 'manual'
  readonly filePath?: string

  /**
   * For manual snippet pinning, this is the exact selected text.
   * For manual file pinning, this is the full file content.
   * For auto context, this stays undefined (no preview required).
   */
  readonly snippet?: string

  /**
   * For auto context: union score of independent factors.
   */
  readonly score?: number

  /**
   * Exact range for snippet / best-match range for auto context.
   * Undefined for BM25-only candidates.
   */
  readonly matchRange?: TextRange
}

export type ScoredCandidate = Readonly<{
  filePath: string
  score: number
}>

export type ParsedOAuthCallback =
  | Readonly<{ kind: 'code'; code: string }>
  | Readonly<{
      kind: 'implicit'
      accessToken: string
      refreshToken: string
      expiresAtUnixSeconds: number | undefined
    }>

export type EngineWithMapping = {
  readonly engine: WinkBm25Engine
  readonly idToPath: string[]
}

export type RgSearchResult = Readonly<{
  file: string
  matchRange: TextRange
  matchedLineText: string
  score: number
}>

export type RgParsedMatch = Readonly<{
  type: 'match'
  data: Readonly<{
    path: Readonly<{ text: string }>
    lines: Readonly<{ text: string }>
    line_number: number
    submatches: ReadonlyArray<
      Readonly<{
        start: number
        end: number
      }>
    >
  }>
}>

export type ExtensionLogger = Readonly<{
  log: (message: string, ...args: unknown[]) => void
  warn: (message: string, ...args: unknown[]) => void
}>

export type SupabaseSessionPayload = Readonly<{
  accessToken: string
  refreshToken: string
  expiresAtUnixSeconds: number | undefined
}>

export type SupabaseConfiguration = Readonly<{
  supabaseUrl: string
  supabaseAnonKey: string
}>

export type FileSignalProvider = {
  getSignalsForFile(filePath: string): FileSignals
  listHotFilePaths(): readonly string[]
}

export type SearchTermKind = 'phrase' | 'token'

export type SearchTerm = Readonly<{
  kind: SearchTermKind
  value: string
}>

export type RgRunOutput = Readonly<{
  stdout: string
  stderr: string
  // eslint-disable-next-line @typescript-eslint/no-restricted-types
  exitCode: number | null
}>

export type Bm25Runtime = Readonly<{
  rootFsPath: string
  bm25IndexService: Bm25IndexService
  rebuildQueue: Bm25RebuildQueue
  watcher: vscode.Disposable
  hourlyTimer: NodeJS.Timeout
  referenceCount: number
}>

export type Bm25RuntimeHandle = Readonly<{
  bm25IndexService: Bm25IndexService
  dispose: () => void
}>

export type UiTextRange = Readonly<{
  startLine: number
  startCharacter: number
  endLine: number
  endCharacter: number
}>

export type TextRange = UiTextRange

export type ContextSnapshotMessage = Readonly<{
  type: 'context:snapshot'
  pinnedFiles: Array<{ filePath: string; range?: UiTextRange }>
  pinnedSnippets: Array<{ id: string; filePath: string; snippet: string; range: UiTextRange }>
}>

export type PinFileMessage = Readonly<{ type: 'context:pinFile'; filePath: string }>
export type PinSnippetMessage = Readonly<{
  type: 'context:pinSnippet'
  id: string
  filePath: string
  snippet: string
  range: UiTextRange
}>

export type ContextUnpinFileMessage = Readonly<{ type: 'context:unpinFile'; filePath: string }>
export type ContextClearAllMessage = Readonly<{ type: 'context:clearAll' }>

export type WebviewMessage =
  | Readonly<{ type: 'sidebar.ready' }>
  | Readonly<{ type: 'contextRoot.get' }>
  | Readonly<{ type: 'contextRoot.pick' }>
  | Readonly<{ type: 'contextRoot.clear' }>
  | Readonly<{ type: 'contextRoot.openSettings' }>
  | Readonly<{ type: 'autoContext:request'; requestId: string; query: string }>
  | Readonly<{ type: 'fileContext:resolve'; requestId: string; filePaths: string[] }>
  | Readonly<{ type: 'auth.login' }>
  | Readonly<{ type: 'auth.getSession' }>
  | ContextUnpinFileMessage
  | ContextClearAllMessage
