/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Buffer } from 'node:buffer'
import * as vscode from 'vscode'
import { Result, ResultAsync, err, ok } from 'neverthrow'
import PQueue from 'p-queue'
import { JsonParseError, safeJsonParse } from '@babadeluxe/shared/utils'
// @ts-expect-error No declaration file
import bm25, { type WinkBm25Engine } from 'wink-bm25-text-search'
import { pickAdaptiveCandidates, pickAdaptiveScoredCandidates } from './adaptive-candidates.js'
import { type EngineWithMapping, type ScoredCandidate } from './types.js'
import { IndexStorage } from './index-storage.js'
import { extractSearchTerms } from './search-term-extractor.js'
import { logger } from './logger.js'
import { listIndexableFiles } from './rg-file-lister.js'
import { Bm25IndexConsolidationError, FileReadError } from './errors.js'

export class Bm25IndexService {
  private _engine?: WinkBm25Engine
  private _idToPath: string[] = []

  private _isBuilding = false

  public constructor(
    private readonly _context: vscode.ExtensionContext,
    private readonly _contextRootFsPath: string
  ) {}

  public async loadCacheIfPossible(): Promise<Result<void, Error>> {
    const storage = new IndexStorage(this._context)
    if (!storage.getIsAvailable()) return ok(undefined)

    const dirUri = storage.getIndexDirectoryUri(this._contextRootFsPath)

    const engineJson = await storage.readJsonFile(dirUri, 'engine.json')
    const idToPathJson = await storage.readJsonFile(dirUri, 'idToPath.json')

    if (!engineJson || !idToPathJson) return ok(undefined)

    const parseResult = safeJsonParse(idToPathJson).andThen((parsed) => {
      if (!Array.isArray(parsed)) return err(new JsonParseError('idToPath.json is not an array'))
      if (parsed.some((value) => typeof value !== 'string'))
        return err(new JsonParseError('idToPath.json contains non-string values'))
      return ok(parsed as string[])
    })

    if (parseResult.isErr()) {
      logger.warn(`[bm25] Failed to parse cached index: ${parseResult.error.message}`)
      return ok(undefined)
    }

    const engine = bm25()
    engine.defineConfig({ fldWeights: { path: 3, content: 1 } })
    engine.definePrepTasks([this._prepTokens.bind(this)])
    engine.importJSON(engineJson)

    this._engine = engine
    this._idToPath = parseResult.value

    return ok(undefined)
  }

  public async rebuildInBackground(): Promise<Result<void, Error>> {
    if (this._isBuilding) return ok(undefined)

    this._isBuilding = true

    const buildResult = await this._buildFreshEngine()
    this._isBuilding = false

    if (buildResult.isErr()) return err(buildResult.error)

    this._engine = buildResult.value.engine
    this._idToPath = buildResult.value.idToPath

    const persistResult = await this._persistEngineIfPossible()
    if (persistResult.isErr())
      logger.warn(`[bm25] Failed to persist index: ${persistResult.error.message}`)

    logger.log(`[bm25] rebuild complete, docs=${this._idToPath.length}`)
    return ok(undefined)
  }

  public searchAdaptiveFilePaths(query: string): string[] {
    const scored = this._searchScoredFilePaths(query, 120)
    return pickAdaptiveCandidates(scored)
  }

  public searchAdaptiveCandidates(query: string): ScoredCandidate[] {
    const scored = this._searchScoredFilePaths(query, 120)
    return pickAdaptiveScoredCandidates(scored)
  }

  private _searchScoredFilePaths(query: string, limit: number): ScoredCandidate[] {
    const engine = this._engine
    if (!engine) return []

    const results = engine.search(query, limit)
    const scored: ScoredCandidate[] = []

    for (const [uniqueId, score] of results) {
      const filePath = this._idToPath[uniqueId]
      if (!filePath) continue
      scored.push({ filePath, score })
    }

    return scored
  }

  private _prepTokens(text: string): string[] {
    return extractSearchTerms(text)
      .map((term) => term.value.toLowerCase())
      .filter(Boolean)
  }

  private async _buildFreshEngine(): Promise<Result<EngineWithMapping, Error>> {
    const filesResult = await listIndexableFiles(this._contextRootFsPath)
    if (filesResult.isErr()) return err(filesResult.error)

    const files = filesResult.value

    if (files.length < 2) {
      logger.warn(
        `[bm25] Workspace "${this._contextRootFsPath}" has only ${files.length} indexable file(s). BM25 requires 2+ documents. Skipping index build.`
      )
      return err(
        new Bm25IndexConsolidationError('Workspace has too few files for BM25 indexing (needs 2+)')
      )
    }

    const engine = bm25()
    engine.defineConfig({ fldWeights: { path: 3, content: 1 } })
    engine.definePrepTasks([this._prepTokens.bind(this)])

    const idToPath: string[] = []
    const fileWithIds = files.map((absolutePath, index) => ({ absolutePath, uniqueId: index }))
    for (const { absolutePath } of fileWithIds) idToPath.push(absolutePath)

    const queue = new PQueue({ concurrency: 10 })
    const successfulIds = new Set<number>()

    const readTasks = fileWithIds.map(async ({ absolutePath, uniqueId }) =>
      queue.add(async () => {
        const readResult = await this._readAndIndexFile(absolutePath, engine, uniqueId)
        if (readResult.isOk()) successfulIds.add(uniqueId)
        else logger.warn(`[bm25] Skipped file ${absolutePath}: ${readResult.error.message}`)
      })
    )

    await Promise.all(readTasks)

    const validIdToPath = idToPath.filter((_, index) => successfulIds.has(index))
    if (validIdToPath.length < 2) {
      logger.warn(
        `[bm25] Only ${validIdToPath.length} file(s) were successfully read. BM25 requires 2+ documents. Skipping consolidation.`
      )
      return err(
        new Bm25IndexConsolidationError('Too few readable files for BM25 indexing (needs 2+)')
      )
    }

    const consolidateResult = Result.fromThrowable(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      () => engine.consolidate(),
      (error) =>
        error instanceof Error
          ? new Bm25IndexConsolidationError(error.message)
          : new Bm25IndexConsolidationError('Failed to consolidate BM25 index.')
    )()

    if (consolidateResult.isErr()) return err(consolidateResult.error)

    return ok({ engine, idToPath: validIdToPath })
  }

  private async _readAndIndexFile(
    absolutePath: string,
    engine: WinkBm25Engine,
    uniqueId: number
  ): Promise<Result<void, FileReadError>> {
    const uri = vscode.Uri.file(absolutePath)

    const readResult = await ResultAsync.fromPromise(
      vscode.workspace.fs.readFile(uri),
      (error: unknown) =>
        new FileReadError(
          `Failed to read file "${absolutePath}": ${error instanceof Error ? error.message : String(error)}`
        )
    )

    if (readResult.isErr()) return err(readResult.error)

    const content = Buffer.from(readResult.value).toString('utf8')
    const cappedContent = content.length > 50_000 ? content.slice(0, 50_000) : content

    engine.addDoc({ path: absolutePath, content: cappedContent }, uniqueId)

    return ok(undefined)
  }

  private async _persistEngineIfPossible(): Promise<Result<void, Error>> {
    if (!this._engine) return ok(undefined)

    const storage = new IndexStorage(this._context)
    if (!storage.getIsAvailable()) return ok(undefined)

    const dirUri = storage.getIndexDirectoryUri(this._contextRootFsPath)

    const writeEngineResult = await ResultAsync.fromPromise(
      storage.writeJsonFile(dirUri, 'engine.json', this._engine.exportJSON()),
      (error: unknown) =>
        new Error(
          `Failed to write engine.json: ${error instanceof Error ? error.message : String(error)}`
        )
    )
    if (writeEngineResult.isErr()) return err(writeEngineResult.error)

    const writeIdToPathResult = await ResultAsync.fromPromise(
      storage.writeJsonFile(dirUri, 'idToPath.json', JSON.stringify(this._idToPath)),
      (error: unknown) =>
        new Error(
          `Failed to write idToPath.json: ${error instanceof Error ? error.message : String(error)}`
        )
    )
    if (writeIdToPathResult.isErr()) return err(writeIdToPathResult.error)

    return ok(undefined)
  }
}
