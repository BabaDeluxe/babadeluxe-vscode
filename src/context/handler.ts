import * as path from 'node:path'
import { randomUUID } from 'node:crypto'
import { ok, err, type Result } from 'neverthrow'
import { type Ref, useActiveTextEditor, useVisibleTextEditors, computed } from 'reactive-vscode'
import type { GrowthBook } from '@growthbook/growthbook'
import type { RgContextBuilder } from './builder.js'
import type { UiContextItem } from './types.js'
import { ContextBuildError } from './errors.js'
import { logger } from '../system/log.js'
import type { Bm25IndexService } from '../bm25/service.js'
import { useGitRecencyMap } from '../git/map.js'
import { useRecentFiles } from '../scoring/recent.js'
import { type ScoringContext, useContextScorer } from '../scoring/context.js'
import { type TextRange } from '../scoring/types.js'

type ScoredCandidate = {
  filePath: string
  score: number
  matchRange?: TextRange
  source: 'bm25' | 'rg' | 'mixed'
}

export class AutoContextHandler {
  private readonly _scoringContext: Ref<ScoringContext>
  private readonly _getSignalBoost: (filePath: string) => number
  private readonly _ensureGitRecencyFor: (filePath: string) => Promise<void>

  public constructor(
    private readonly _contextRootFsPath: string,
    private readonly _contextBuilder: RgContextBuilder,
    private readonly _bm25IndexService?: Bm25IndexService,
    private readonly _gb?: GrowthBook
  ) {
    const activeEditor = useActiveTextEditor()
    const visibleEditors = useVisibleTextEditors()
    const recentFiles = useRecentFiles()
    const { gitRecencyByPath, ensureRecencyFor } = useGitRecencyMap(_contextRootFsPath)

    this._scoringContext = computed(() => ({
      activeFilePath: activeEditor.value?.document.uri.fsPath,
      visibleFilePaths: new Set(visibleEditors.value.map((editor) => editor.document.uri.fsPath)),
      recentFilePaths: recentFiles.value,
      gitRecencyByPath: gitRecencyByPath.value,
    }))

    this._getSignalBoost = useContextScorer(this._scoringContext)
    this._ensureGitRecencyFor = ensureRecencyFor
  }

  public async handleRequest(query: string): Promise<Result<UiContextItem[], ContextBuildError>> {
    if (!query?.trim()) return err(new ContextBuildError('Query cannot be empty'))

    const startTime = Date.now()
    const bm25Result = this._bm25IndexService?.searchAdaptiveCandidates(query) ?? []
    const rgResult = await this._contextBuilder.buildContext(query)

    const mergedCandidates = this._mergeAndScore(bm25Result, rgResult)
    const duration = Date.now() - startTime

    logger.log(`Built ${mergedCandidates.length} context references for query: "${query}" in ${duration}ms`)

    this._gb?.track('auto-context-request', {
      queryLength: query.length,
      itemCount: mergedCandidates.length,
      durationMs: duration,
      hasBm25: !!this._bm25IndexService,
      rgSuccess: rgResult.isOk()
    })

    return ok(mergedCandidates)
  }

  private _mergeAndScore(
    bm25Candidates: Array<{ filePath: string; score: number }>,
    rgResult: Result<ReadonlyArray<{ file: string; score: number; matchRange: TextRange }>, unknown>
  ): UiContextItem[] {
    const candidateMap = new Map<string, ScoredCandidate>()

    const maxBm25 = bm25Candidates.length > 0 ? (bm25Candidates[0]?.score ?? 1) : 1
    for (const c of bm25Candidates) {
      const absPath = this._resolvePath(c.filePath)
      candidateMap.set(absPath, {
        filePath: absPath,
        score: (c.score / maxBm25) * 50,
        source: 'bm25',
      })
    }

    if (rgResult.isOk()) {
      for (const r of rgResult.value) {
        const absPath = this._resolvePath(r.file)
        const existing = candidateMap.get(absPath)
        const currentScore = existing?.score ?? 0

        candidateMap.set(absPath, {
          filePath: absPath,
          score: currentScore + r.score,
          matchRange: r.matchRange,
          source: existing ? 'mixed' : 'rg',
        })
      }
    } else {
      logger.warn('[context] RG search failed:', rgResult.error)
    }

    const items: UiContextItem[] = []

    if (candidateMap.size === 0) {
      return []
    }

    for (const candidate of candidateMap.values()) {
      void this._ensureGitRecencyFor(candidate.filePath)

      const boost = this._getSignalBoost(candidate.filePath)

      items.push({
        id: randomUUID(),
        kind: 'auto',
        filePath: candidate.filePath,
        score: candidate.score + boost,
        matchRange: candidate.matchRange,
      })
    }

    return items.sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 120)
  }

  private _resolvePath(filePath: string): string {
    return path.isAbsolute(filePath) ? filePath : path.join(this._contextRootFsPath, filePath)
  }
}
