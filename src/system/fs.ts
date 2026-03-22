import { Buffer } from 'node:buffer'
import * as vscode from 'vscode'
import { err, ok, type Result, ResultAsync } from 'neverthrow'
import { ignoredDirectories, maxFolderPinFiles } from './constants.js'
import { logger } from './log.js'

export class FileReadError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message)
    this.name = 'FileReadError'
  }
}

export class FolderScanError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message)
    this.name = 'FolderScanError'
  }
}

export async function readWorkspaceFile(
  uri: vscode.Uri
): Promise<Result<string, FileReadError>> {
  const readResult = await ResultAsync.fromPromise(
    vscode.workspace.fs.readFile(uri),
    (error: unknown) =>
      new FileReadError(
        `Failed to read file "${uri.fsPath}": ${error instanceof Error ? error.message : String(error)}`,
        error
      )
  )

  if (readResult.isErr()) return err(readResult.error)
  return ok(Buffer.from(readResult.value).toString('utf8'))
}

export type FolderScanResult = {
  fileUris: vscode.Uri[]
  maxDepth: number
  wasCapped: boolean
}

export async function scanFolderForIndexableFiles(options: {
  rootFolderUri: vscode.Uri
  maxFiles?: number
}): Promise<Result<FolderScanResult, FolderScanError>> {
  const { rootFolderUri, maxFiles = maxFolderPinFiles } = options
  const fileUris: vscode.Uri[] = []
  let maxDepth = 0
  let wasCapped = false

  async function walk(currentUri: vscode.Uri, depth: number): Promise<void> {
    if (wasCapped) return
    maxDepth = Math.max(maxDepth, depth)

    if (depth > 10) return

    let entries: [string, vscode.FileType][]
    try {
      entries = await vscode.workspace.fs.readDirectory(currentUri)
    } catch (error: unknown) {
      logger.warn(`Failed to read directory "${currentUri.fsPath}": ${String(error)}`)
      return
    }

    for (const [name, type] of entries) {
      if (wasCapped) break

      if (ignoredDirectories.has(name)) continue

      const entryUri = vscode.Uri.joinPath(currentUri, name)

      if (type === vscode.FileType.Directory) {
        await walk(entryUri, depth + 1)
      } else if (type === vscode.FileType.File) {
        fileUris.push(entryUri)
        if (fileUris.length >= maxFiles) {
          wasCapped = true
        }
      }
    }
  }

  try {
    await walk(rootFolderUri, 0)
    return ok({ fileUris, maxDepth, wasCapped })
  } catch (error: unknown) {
    return err(
      new FolderScanError(
        `Failed to scan folder "${rootFolderUri.fsPath}": ${error instanceof Error ? error.message : String(error)}`,
        error
      )
    )
  }
}
