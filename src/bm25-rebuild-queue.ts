import PQueue from 'p-queue'
import type { logger } from './logger.js'

export class Bm25RebuildQueue {
  private readonly _queue = new PQueue({ concurrency: 1 })
  private _debounceTimer?: NodeJS.Timeout
  private _pendingReason = 'unknown'
  private _isDisposed = false

  public constructor(
    private readonly _debounceMs: number,
    private readonly _runRebuild: (reason: string) => Promise<void>,
    private readonly _logger: typeof logger
  ) {}

  public request(reason: string): void {
    if (this._isDisposed) return

    this._pendingReason = reason

    if (this._debounceTimer) clearTimeout(this._debounceTimer)

    this._debounceTimer = setTimeout(() => {
      this._debounceTimer = undefined

      void (async (): Promise<void> => {
        try {
          await this._enqueue(this._pendingReason)
        } catch (error: unknown) {
          this._logger.error('BM25 rebuild enqueue failed:', error)
        }
      })()
    }, this._debounceMs)
  }

  public dispose(): void {
    this._isDisposed = true
    if (this._debounceTimer) clearTimeout(this._debounceTimer)
    this._debounceTimer = undefined

    this._queue.pause()
    this._queue.clear()
  }

  private async _enqueue(reason: string): Promise<void> {
    return this._queue.add(async () => this._runRebuild(reason))
  }
}
