import { Result, err, ok, type Result as ResultType } from 'neverthrow'
import { ignoreGlobs } from '../infra/constants.js'
import { indexableFileIncludeGlobs } from '../infra/indexable-file-extensions.js'
import { RgSearchError } from './errors.js'
import { getRgPath } from '../ripgrep/rg-wrapper.js'
import { logger } from '../infra/logger.js'
import { runRg } from '../ripgrep/rg-runner.js'
import { extractSearchTerms } from '../scoring/search-term-extractor.js'
import type { RgParsedMatch, RgSearchResult } from '../ripgrep/types.js'
import type { TextRange } from '../scoring/types.js'

function isRgParsedMatch(value: unknown): value is RgParsedMatch {
  if (typeof value !== 'object' || value === null) return false

  const maybe = value as Partial<RgParsedMatch>
  if (maybe.type !== 'match') return false

  const { data } = maybe
  if (typeof data !== 'object' || data === null) return false

  const dataRecord = data as Record<string, unknown>
  const pathObject = dataRecord['path'] as Record<string, unknown> | undefined
  const linesObject = dataRecord['lines'] as Record<string, unknown> | undefined
  const lineNumber = dataRecord['line_number'] as number | undefined
  const submatches = dataRecord['submatches'] as unknown[] | undefined

  const hasPath =
    typeof pathObject === 'object' && pathObject !== null && typeof pathObject['text'] === 'string'

  const hasLines =
    typeof linesObject === 'object' && linesObject !== null && typeof linesObject['text'] === 'string'

  const hasLineNumber = typeof lineNumber === 'number' && Number.isFinite(lineNumber)

  const hasSubmatches =
    Array.isArray(submatches) &&
    submatches.every(
      (s) =>
        typeof s === 'object' &&
        s !== null &&
        typeof (s as Record<string, unknown>)['start'] === 'number' &&
        Number.isFinite((s as Record<string, unknown>)['start']) &&
        typeof (s as Record<string, unknown>)['end'] === 'number' &&
        Number.isFinite((s as Record<string, unknown>)['end'])
    )

  return hasPath && hasLines && hasLineNumber && hasSubmatches
}

type RgRawBestMatch = Readonly<{
  file: string
  matchRange: TextRange
  matchedLineText: string
}>

export class RgContextBuilder {
  public constructor(
    private readonly _cwd: string,
    private readonly _maxResults = 20
  ) {}

  public async buildContext(query: string): Promise<ResultType<RgSearchResult[], RgSearchError>> {
    const trimmed = query.trim()
    if (!trimmed) return ok([])

    const terms = extractSearchTerms(trimmed)
    if (terms.length === 0) return ok([])

    const rgPathResult = await getRgPath()
    if (rgPathResult.isErr()) return err(new RgSearchError(rgPathResult.error.message))

    const args = this._buildSearchArgs(terms, [this._cwd])
    const runResult = await runRg(rgPathResult.value, this._cwd, args)
    if (runResult.isErr()) return err(new RgSearchError(runResult.error.message))

    const parsedResult = this._parseSearchOutput(runResult.value)
    if (parsedResult.isErr()) return err(parsedResult.error)

    const scored = this._scoreResults(parsedResult.value, terms)
    return ok(scored.slice(0, this._maxResults))
  }

  public async buildContextFromCandidates(
    query: string,
    candidatePaths: readonly string[]
  ): Promise<ResultType<RgSearchResult[], RgSearchError>> {
    const trimmed = query.trim()
    if (!trimmed) return ok([])

    const terms = extractSearchTerms(trimmed)
    if (terms.length === 0) return ok([])

    const uniqueCandidates = [...new Set(candidatePaths.map((p) => p.trim()).filter(Boolean))]
    if (uniqueCandidates.length === 0) return ok([])

    const rgPathResult = await getRgPath()
    if (rgPathResult.isErr()) return err(new RgSearchError(rgPathResult.error.message))

    const args = this._buildSearchArgs(terms, uniqueCandidates)
    const runResult = await runRg(rgPathResult.value, this._cwd, args)
    if (runResult.isErr()) return err(new RgSearchError(runResult.error.message))

    const parsedResult = this._parseSearchOutput(runResult.value)
    if (parsedResult.isErr()) return err(parsedResult.error)

    const scored = this._scoreResults(parsedResult.value, terms)
    return ok(scored.slice(0, this._maxResults))
  }

  private _buildSearchArgs(
    terms: ReadonlyArray<{ value: string }>,
    paths: readonly string[]
  ): string[] {
    const termArgs: string[] = []
    for (const term of terms) termArgs.push('-e', term.value)

    const includeGlobArgs = indexableFileIncludeGlobs.flatMap((glob) => ['--glob', glob])
    const ignoreGlobArgs = ignoreGlobs.flatMap((glob) => ['--glob', glob])

    return [
      '--json',
      '--max-filesize',
      '512K',
      '--fixed-strings',
      '--ignore-case',

      ...includeGlobArgs,
      ...ignoreGlobArgs,

      ...termArgs,

      '--',
      ...paths,
    ]
  }

  private _parseSearchOutput(
    run: Readonly<{
      stdout: string
      stderr: string
      exitCode: number | null
    }>
  ): ResultType<RgRawBestMatch[], RgSearchError> {
    const { exitCode, stderr, stdout } = run

    if (exitCode === 1) return ok([])
    if (exitCode !== 0)
      return err(new RgSearchError(`ripgrep exited with code ${exitCode}: ${stderr}`))

    return Result.fromThrowable(
      () => this._parseRgJson(stdout),
      (error) => new RgSearchError('Failed to parse ripgrep output', error instanceof Error ? error : new Error(String(error)))
    )()
  }

  private _parseRgJson(output: string): RgRawBestMatch[] {
    const lines = output.trim().split('\n')
    const bestByFile = new Map<string, RgRawBestMatch>()

    for (const line of lines) {
      if (!line.trim()) continue

      const parseResult = Result.fromThrowable(
        () => JSON.parse(line) as unknown,
        (error) => (error instanceof Error ? error : new Error(String(error)))
      )()

      if (parseResult.isErr()) {
        logger.warn('Skipping invalid JSON line from ripgrep.')
        continue
      }

      const json = parseResult.value
      if (!isRgParsedMatch(json)) continue

      const file = json.data.path.text
      const oneBasedLineNumber = json.data.line_number
      const firstSubmatch = json.data.submatches[0]
      if (!firstSubmatch) continue

      const candidate: RgRawBestMatch = {
        file,
        matchedLineText: json.data.lines.text.trim(),
        matchRange: {
          startLine: Math.max(0, oneBasedLineNumber - 1),
          startCharacter: Math.max(0, firstSubmatch.start),
          endLine: Math.max(0, oneBasedLineNumber - 1),
          endCharacter: Math.max(0, firstSubmatch.end),
        },
      }

      const existing = bestByFile.get(file)
      if (!existing) {
        bestByFile.set(file, candidate)
        continue
      }

      const isEarlier =
        candidate.matchRange.startLine < existing.matchRange.startLine ||
        (candidate.matchRange.startLine === existing.matchRange.startLine &&
          candidate.matchRange.startCharacter < existing.matchRange.startCharacter)

      if (isEarlier) bestByFile.set(file, candidate)
    }

    return [...bestByFile.values()]
  }

  private _scoreResults(
    results: RgRawBestMatch[],
    terms: ReadonlyArray<{ kind: 'phrase' | 'token'; value: string }>
  ): RgSearchResult[] {
    return results
      .map((result) => {
        let score = 0

        const lineLower = result.matchedLineText.toLowerCase()
        for (const term of terms) {
          const termLower = term.value.toLowerCase()
          if (!termLower || !lineLower.includes(termLower)) continue
          score += term.kind === 'phrase' ? 50 : 10
        }

        return {
          file: result.file,
          matchRange: result.matchRange,
          matchedLineText: result.matchedLineText,
          score,
        }
      })
      .sort((a, b) => b.score - a.score)
  }
}
