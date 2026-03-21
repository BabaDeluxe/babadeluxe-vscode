export type FileSignals = {
  readonly isActive: boolean
  readonly isOpen: boolean
  readonly wasEditedThisSession: boolean
  readonly sameDirAsActive: boolean
  readonly importsActive: boolean
  readonly importedByActive: boolean
  readonly recentlyTouchedInGit: boolean
}

export type ScoredCandidate = Readonly<{
  filePath: string
  score: number
}>

export type UiTextRange = Readonly<{
  startLine: number
  startCharacter: number
  endLine: number
  endCharacter: number
}>

export type TextRange = UiTextRange

export type SearchTermKind = 'phrase' | 'token'

export type SearchTerm = Readonly<{
  kind: SearchTermKind
  value: string
}>
