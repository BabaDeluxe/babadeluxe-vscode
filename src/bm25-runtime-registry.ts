import type * as vscode from 'vscode'
import { Bm25IndexService } from './bm25-index-service.js'
import { Bm25RebuildQueue } from './bm25-rebuild-queue.js'
import { createBm25IndexWatcher } from './bm25-index-watcher.js'
import { isContextRootInsideWorkspace } from './workspace-scope.js'
import { logger } from './logger.js'
import type { Bm25Runtime, Bm25RuntimeHandle } from './types.js'

const runtimesByRootFsPath = new Map<string, Bm25Runtime>()
let isShutdownHookRegistered = false

function canUseBm25(context: vscode.ExtensionContext, rootFsPath: string): boolean {
  return context.storageUri !== undefined && isContextRootInsideWorkspace(rootFsPath)
}

function registerShutdownHookOnce(context: vscode.ExtensionContext): void {
  if (isShutdownHookRegistered) return
  isShutdownHookRegistered = true

  context.subscriptions.push({
    dispose() {
      for (const runtime of runtimesByRootFsPath.values()) {
        disposeRuntime(runtime)
      }

      runtimesByRootFsPath.clear()
    },
  })
}

function disposeRuntime(runtime: Bm25Runtime): void {
  runtime.watcher.dispose()
  runtime.rebuildQueue.dispose()
  clearInterval(runtime.hourlyTimer)
}

async function createRuntime(
  context: vscode.ExtensionContext,
  rootFsPath: string
): Promise<Bm25Runtime> {
  const bm25IndexService = new Bm25IndexService(context, rootFsPath)

  const rebuildQueue = new Bm25RebuildQueue(5000, async (reason) => {
    const result = await bm25IndexService.rebuildInBackground()
    if (result.isErr()) {
      logger.warn(`[bm25] rebuild failed (${reason}): ${result.error.message}`)
    }
  })

  await bm25IndexService.loadCacheIfPossible()
  rebuildQueue.request('startup')

  const watcher = createBm25IndexWatcher(rootFsPath, (reason) => {
    rebuildQueue.request(reason)
  })

  const hourlyTimer = setInterval(
    () => {
      rebuildQueue.request('hourly')
    },
    60 * 60 * 1000
  )

  logger.log(`[bm25] runtime created for root: ${rootFsPath}`)

  return {
    rootFsPath,
    bm25IndexService,
    rebuildQueue,
    watcher,
    hourlyTimer,
    referenceCount: 1,
  }
}

export async function acquireBm25Runtime(
  context: vscode.ExtensionContext,
  rootFsPath: string
): Promise<Bm25RuntimeHandle | undefined> {
  registerShutdownHookOnce(context)

  if (!canUseBm25(context, rootFsPath)) return undefined

  const existing = runtimesByRootFsPath.get(rootFsPath)
  if (existing) {
    const updated: Bm25Runtime = { ...existing, referenceCount: existing.referenceCount + 1 }
    runtimesByRootFsPath.set(rootFsPath, updated)

    return {
      bm25IndexService: updated.bm25IndexService,
      dispose() {
        releaseBm25Runtime(rootFsPath)
      },
    }
  }

  const runtime = await createRuntime(context, rootFsPath)
  runtimesByRootFsPath.set(rootFsPath, runtime)

  return {
    bm25IndexService: runtime.bm25IndexService,
    dispose() {
      releaseBm25Runtime(rootFsPath)
    },
  }
}

export function releaseBm25Runtime(rootFsPath: string): void {
  const runtime = runtimesByRootFsPath.get(rootFsPath)
  if (!runtime) return

  const nextReferenceCount = runtime.referenceCount - 1
  if (nextReferenceCount > 0) {
    const updated: Bm25Runtime = { ...runtime, referenceCount: nextReferenceCount }
    runtimesByRootFsPath.set(rootFsPath, updated)
    return
  }

  disposeRuntime(runtime)
  runtimesByRootFsPath.delete(rootFsPath)
  logger.log(`[bm25] runtime disposed for root: ${rootFsPath}`)
}
