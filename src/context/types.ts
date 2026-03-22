import { TextRange, UiTextRange } from '../scoring/types.js'

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
