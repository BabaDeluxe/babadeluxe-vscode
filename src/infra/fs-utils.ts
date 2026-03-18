import * as vscode from 'vscode'
import PQueue from 'p-queue'
import { err, ok, type Result, ResultAsync } from 'neverthrow'
import { ignoredDirectories, maxFolderPinFiles } from '../infra/constants.js'
import { logger } from '../infra/logger.js'
import { FolderReadDirectoryError, FolderScanQueueError } from './errors.js'

type FolderScanResult = Readonly<{
  fileUris: vscode.Uri[]
  maxDepth: number
  wasCapped: boolean
}>

async function readDirectory(
  uri: vscode.Uri
): Promise<Result<ReadonlyArray<[string, vscode.FileType]>, FolderReadDirectoryError>> {
  const result = await ResultAsync.fromPromise(
    vscode.workspace.fs.readDirectory(uri),
    (cause: unknown) =>
      new FolderReadDirectoryError(`readDirectory failed for ${uri.toString()}`, cause)
  )

  if (result.isErr()) {
    logger.error('scanFolderForIndexableFiles: readDirectory failed', result.error)
    return err(result.error)
  }

  return ok(result.value)
}

export async function scanFolderForIndexableFiles({
  rootFolderUri,
  maxFiles = maxFolderPinFiles,
  maxConcurrentDirectoryReads = 16,
}: {
  rootFolderUri: vscode.Uri
  maxFiles?: number
  maxConcurrentDirectoryReads?: number
}): Promise<Result<FolderScanResult, FolderScanQueueError | FolderReadDirectoryError>> {
  const fileUris: vscode.Uri[] = []
  let maxDepth = 0
  let wasCapped = false

  const queue = new PQueue({ concurrency: maxConcurrentDirectoryReads })
  const taskPromises: Array<Promise<void>> = []

  const stopQueue = (): void => {
    queue.pause()
    queue.clear()
  }

  const enqueueDirectory = (uri: vscode.Uri, depth: number): void => {
    if (wasCapped) return

    const taskPromise = queue.add(async () => {
      if (wasCapped) return

      maxDepth = Math.max(maxDepth, depth)

      const entriesResult = await readDirectory(uri)
      if (entriesResult.isErr()) {
        stopQueue()
        throw entriesResult.error
      }

      for (const [name, fileType] of entriesResult.value) {
        if (wasCapped) return

        if (fileType === vscode.FileType.Directory) {
          if (ignoredDirectories.includes(name as (typeof ignoredDirectories)[number])) continue
          enqueueDirectory(vscode.Uri.joinPath(uri, name), depth + 1)
          continue
        }

        if (fileType === vscode.FileType.File) {
          fileUris.push(vscode.Uri.joinPath(uri, name))

          if (fileUris.length >= maxFiles) {
            wasCapped = true
            stopQueue()
            return
          }
        }
      }
    })

    taskPromises.push(taskPromise)
  }

  enqueueDirectory(rootFolderUri, 0)

  const waitResult = await ResultAsync.fromPromise(
    Promise.race([queue.onError(), queue.onIdle()]),
    (cause: unknown) => new FolderScanQueueError('Folder scan queue failed', cause)
  )
  await Promise.allSettled(taskPromises)

  if (waitResult.isErr()) {
    logger.error('scanFolderForIndexableFiles: queue failed', waitResult.error)
    stopQueue()
    return err(waitResult.error)
  }

  return ok({ fileUris, maxDepth, wasCapped })
}
