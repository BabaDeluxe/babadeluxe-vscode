import type * as vscode from 'vscode'
import { effectScope, onScopeDispose, type EffectScope } from 'reactive-vscode'
import { Bm25IndexService } from './bm25-index-service.js'
import { Bm25RebuildQueue } from './bm25-rebuild-queue.js'
import { useBm25IndexWatcher } from './bm25-index-watcher.js'
import { isContextRootInsideWorkspace } from '../context/workspace-scope.js'
import { logger } from '../infra/logger.js'

type SharedRuntime = {
  scope: EffectScope
  service: Bm25IndexService
  refCount: number
}

// Module-level state acts as the singleton registry
const runtimes = new Map<string, SharedRuntime>()

function canUseBm25(context: vscode.ExtensionContext, rootFsPath: string): boolean {
  return context.storageUri !== undefined && isContextRootInsideWorkspace(rootFsPath)
}

function startHourlyRebuild(request: (reason: string) => void): NodeJS.Timeout {
  return setInterval(
    () => {
      request('hourly')
    },
    60 * 60 * 1000
  )
}

/**
 * Acquires a shared BM25 runtime for the given root path.
 * The runtime is automatically reference-counted and disposed when the caller's scope ends.
 */
export function useBm25Runtime(
  context: vscode.ExtensionContext,
  rootFsPath: string
): Bm25IndexService | undefined {
  if (!canUseBm25(context, rootFsPath)) return undefined

  let runtime = runtimes.get(rootFsPath)

  if (!runtime) {
    const scope = effectScope()
    const service = scope.run(() => {
      logger.log(`[bm25] initializing runtime for root: ${rootFsPath}`)
      const service = new Bm25IndexService(context, rootFsPath)
      let isScopeActive = true

      onScopeDispose(() => {
        isScopeActive = false
      })

      // Setup rebuild queue
      const rebuildQueue = new Bm25RebuildQueue(
        5000,
        async (reason) => {
          const result = await service.rebuildInBackground()
          if (result.isErr()) {
            logger.warn(`[bm25] rebuild failed (${reason}): ${result.error.message}`)
          }
        },
        logger
      )

      // Setup watchers (Composable usage)
      useBm25IndexWatcher(rootFsPath, (reason) => {
        rebuildQueue.request(reason)
      })

      // Setup hourly trigger
      const hourlyTimer = startHourlyRebuild((reason) => {
        rebuildQueue.request(reason)
      })

      onScopeDispose(() => {
        clearInterval(hourlyTimer)
        rebuildQueue.dispose()
      })

      // Initial Load
      void (async () => {
        try {
          await service.loadCacheIfPossible()
        } catch (error: unknown) {
          logger.warn('[bm25] loadCacheIfPossible failed:', error)
        } finally {
          // Only trigger startup build if we haven't been disposed during the async await
          if (isScopeActive) rebuildQueue.request('startup')
        }
      })()

      return service
    })

    // Should theoretically never happen inside a live effect scope
    if (!service) throw new Error('Failed to create BM25 runtime')

    runtime = { scope, service, refCount: 0 }
    runtimes.set(rootFsPath, runtime)
  }

  // Increment reference count
  runtime.refCount++

  // Auto-decrement on caller disposal
  onScopeDispose(() => {
    const r = runtimes.get(rootFsPath)
    if (!r) return

    r.refCount--
    if (r.refCount <= 0) {
      logger.log(`[bm25] disposing runtime for root: ${rootFsPath}`)
      r.scope.stop()
      runtimes.delete(rootFsPath)
    }
  })

  return runtime.service
}

export function disposeAllBm25Runtimes(): void {
  for (const runtime of runtimes.values()) {
    runtime.scope.stop()
  }

  runtimes.clear()
  logger.log('[bm25] all runtimes disposed')
}
