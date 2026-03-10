import type * as vscode from 'vscode'
// @ts-expect-error No declaration file
import { type WinkBm25Engine } from 'wink-bm25-text-search'

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
  readonly snippet?: string
  readonly score?: number
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

/**
 * Structural contract to avoid importing the concrete class here (breaks cycles).
 */
export type Bm25IndexServiceLike = Readonly<{
  loadCacheIfPossible: () => Promise<unknown>
  rebuildInBackground: () => Promise<unknown>
  searchAdaptiveCandidates: (query: string) => ScoredCandidate[]
}>

export type Bm25RuntimeHandle = Readonly<{
  bm25IndexService: Bm25IndexServiceLike
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

export type NavigateToMessage = Readonly<{
  type: 'navigate-to'
  payload: { view: string }
}>

export type WebviewMessage =
  | Readonly<{ type: 'sidebar.ready' }>
  | Readonly<{ type: 'contextRoot.getCurrent' }>
  | Readonly<{ type: 'contextRoot.pick' }>
  | Readonly<{ type: 'contextRoot.clear' }>
  | Readonly<{ type: 'contextRoot.openSettings' }>
  | Readonly<{ type: 'autoContext:request'; requestId: string; query: string }>
  | Readonly<{ type: 'fileContext:resolve'; requestId: string; filePaths: string[] }>
  | Readonly<{ type: 'auth.login' }>
  | Readonly<{ type: 'auth.getSession' }>
  | NavigateToMessage
  | ContextUnpinFileMessage
  | ContextClearAllMessage

export type WebviewCommonApi = {
  postContextRoot: (webview: vscode.Webview) => void
  handleWebviewMessage: (message: WebviewMessage, webview: vscode.Webview) => Promise<boolean>
}
