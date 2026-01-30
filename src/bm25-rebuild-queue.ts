import PQueue from 'p-queue'
import { logger } from './logger.js'

export class Bm25RebuildQueue {
  private readonly _queue = new PQueue({ concurrency: 1 })
  private _debounceTimer?: NodeJS.Timeout
  private _pendingReason = 'unknown'
  private _isDisposed = false

  public constructor(
    private readonly _debounceMs: number,
    private readonly _runRebuild: (reason: string) => Promise<void>
  ) {}

  public request(reason: string): void {
    if (this._isDisposed) return

    this._pendingReason = reason

    if (this._debounceTimer) clearTimeout(this._debounceTimer)
    this._debounceTimer = setTimeout(() => {
      this._debounceTimer = undefined
      // eslint-disable-next-line promise/prefer-await-to-then
      void this._enqueue(this._pendingReason).catch((error: unknown) => {
        // do NOT swallow silently; log or rethrow via a provided logger
        // (we'll wire logger in next step if you want)
        logger.error('BM25 rebuild enqueue failed:', error)
      })
    }, this._debounceMs)
  }

  public dispose(): void {
    this._isDisposed = true
    if (this._debounceTimer) clearTimeout(this._debounceTimer)
    this._debounceTimer = undefined

    this._queue.pause()
    this._queue.clear()
  }

  private async _enqueue(reason: string) {
    return this._queue.add(async () => {
      await this._runRebuild(reason)
    })
  }
}
