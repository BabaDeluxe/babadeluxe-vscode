import { type TextRange } from '../scoring/types.js'

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

export type RgRunOutput = Readonly<{
  stdout: string
  stderr: string
  exitCode: number | null
}>
