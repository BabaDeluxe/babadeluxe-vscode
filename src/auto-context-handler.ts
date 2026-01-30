import * as path from 'node:path'
import { randomUUID } from 'node:crypto'
import { type Result, ok, err } from 'neverthrow'
import type { RgContextBuilder } from './rg-context-builder.js'
import type { FileSignalProvider, TextRange, UiContextItem } from './types.js'
import { ContextBuildError } from './errors.js'
import { logger } from './logger.js'
import type { Bm25IndexService } from './bm25-index-service.js'

type CombinedSignals = {
  bm25Score?: number
  rgScore?: number
  matchRange?: TextRange
}

function calculateSignalBoost(signals: {
  isActive: boolean
  isOpen: boolean
  wasEditedThisSession: boolean
  sameDirAsActive: boolean
  importsActive: boolean
  importedByActive: boolean
  recentlyTouchedInGit: boolean
}): number {
  let boost = 0
  if (signals.isActive) boost += 80
  if (signals.isOpen) boost += 40
  if (signals.wasEditedThisSession) boost += 30
  if (signals.sameDirAsActive) boost += 20
  if (signals.importsActive) boost += 15
  if (signals.importedByActive) boost += 15
  if (signals.recentlyTouchedInGit) boost += 10
  return boost
}

export class AutoContextHandler {
  public constructor(
    private readonly _contextRootFsPath: string,
    private readonly _contextBuilder: RgContextBuilder,
    private readonly _signalProvider: FileSignalProvider,
    private readonly _bm25IndexService?: Bm25IndexService
  ) {}

  public async handleRequest(query: string): Promise<Result<UiContextItem[], ContextBuildError>> {
    if (!query?.trim()) return err(new ContextBuildError('Query cannot be empty'))

    const rawBm25 = this._bm25IndexService?.searchAdaptiveCandidates(query) ?? []
    const maxBm25Score = rawBm25.length > 0 ? Math.max(0, rawBm25[0]!.score) : 0

    const rgResult = await this._contextBuilder.buildContext(query)

    const combinedByFilePath = new Map<string, CombinedSignals>()

    for (const candidate of rawBm25) {
      const filePath = path.isAbsolute(candidate.filePath)
        ? candidate.filePath
        : path.join(this._contextRootFsPath, candidate.filePath)

      combinedByFilePath.set(filePath, { bm25Score: candidate.score })
    }

    let rgResults: ReadonlyArray<{ file: string; score: number; matchRange: TextRange }> = []
    if (rgResult.isOk()) {
      rgResults = rgResult.value
      for (const result of rgResults) {
        const filePath = path.isAbsolute(result.file)
          ? result.file
          : path.join(this._contextRootFsPath, result.file)

        const existing = combinedByFilePath.get(filePath) ?? {}
        combinedByFilePath.set(filePath, {
          ...existing,
          rgScore: result.score,
          matchRange: result.matchRange,
        })
      }
    } else {
      logger.warn('[context] RG search failed, continuing with BM25-only results:', rgResult.error)
      if (combinedByFilePath.size === 0) {
        return err(new ContextBuildError('Failed to search codebase', rgResult.error))
      }
    }

    if (combinedByFilePath.size === 0) {
      const hotFiles = this._signalProvider.listHotFilePaths().slice(0, 30)
      for (const hotFile of hotFiles) {
        combinedByFilePath.set(hotFile, {})
      }
    }

    const rgTopScore = rgResults.length > 0 ? Math.max(0, rgResults[0]!.score) : 0
    const bm25Scale = rgTopScore > 0 ? rgTopScore : 50

    const items: UiContextItem[] = []
    for (const [filePath, signals] of combinedByFilePath.entries()) {
      const bm25Normalized =
        signals.bm25Score !== undefined && maxBm25Score > 0 ? signals.bm25Score / maxBm25Score : 0

      const bm25Contribution = bm25Normalized * bm25Scale
      const rgContribution = signals.rgScore ?? 0

      const signalBoost = calculateSignalBoost(this._signalProvider.getSignalsForFile(filePath))

      items.push({
        id: randomUUID(),
        kind: 'auto',
        filePath,
        score: rgContribution + bm25Contribution + signalBoost,
        matchRange: signals.matchRange,
      })
    }

    items.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))

    const capped = items.slice(0, 120)

    logger.log(
      `Built ${capped.length} context references for query: "${query}" (bm25=${rawBm25.length}, rg=${rgResults.length})`
    )

    return ok(capped)
  }
}
