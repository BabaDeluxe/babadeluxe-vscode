import * as vscode from 'vscode'
import type { Ignore } from 'ignore'
import { onScopeDispose, useFileSystemWatcher } from 'reactive-vscode'
import { ignoredDirectories } from './constants.js'
import { indexableFileWatcherGlob, isIndexableFileExtension } from './indexable-file-extensions.js'
import { loadRootGitignore, isIgnoredByRootGitignore } from './root-gitignore.js'
import { logger } from './logger.js'

function toSlashPath(fsPath: string): string {
  return fsPath.replaceAll('\\\\', '/')
}

function isInsideIgnoredDirectory(fileFsPath: string): boolean {
  const slashPath = toSlashPath(fileFsPath)
  for (const directoryName of ignoredDirectories) {
    if (slashPath.includes(`/${directoryName}/`)) return true
  }

  return false
}

/**
 * Composable that watches for file system changes and gitignore updates
 * to trigger BM25 index rebuilds.
 */
export function useBm25IndexWatcher(
  rootFsPath: string,
  requestRebuild: (reason: string) => void
): void {
  let gitignoreMatcher: Ignore | undefined
  let isDisposed = false

  onScopeDispose(() => {
    isDisposed = true
    gitignoreMatcher = undefined
  })

  const reloadGitignore = async (reason: string): Promise<void> => {
    if (isDisposed) return

    const result = await loadRootGitignore(rootFsPath)

    // Check disposed again after await
    if (isDisposed) return

    if (result.isErr()) {
      logger.warn(`[bm25] Failed to load .gitignore: ${result.error.message}`)
      gitignoreMatcher = undefined
      return
    }

    gitignoreMatcher = result.value
    requestRebuild(reason)
  }

  // Initial load
  void reloadGitignore('gitignore:startup')

  const shouldTriggerReindex = (fileFsPath: string): boolean => {
    if (isDisposed || isInsideIgnoredDirectory(fileFsPath) || !isIndexableFileExtension(fileFsPath))
      return false

    // If we have a matcher, verify the file isn't ignored.
    // If we don't have a matcher (yet or failed), we default to indexing.
    const matcher = gitignoreMatcher
    if (!matcher) return true

    return !isIgnoredByRootGitignore(rootFsPath, matcher, fileFsPath)
  }

  // Watch source files
  const filePattern = new vscode.RelativePattern(
    vscode.Uri.file(rootFsPath),
    indexableFileWatcherGlob
  )

  useFileSystemWatcher(filePattern, {
    onDidCreate(uri) {
      if (shouldTriggerReindex(uri.fsPath)) requestRebuild(`fs:create:${uri.fsPath}`)
    },
    onDidChange(uri) {
      if (shouldTriggerReindex(uri.fsPath)) requestRebuild(`fs:change:${uri.fsPath}`)
    },
    onDidDelete(uri) {
      // For deletes, we should check if it WAS indexed, but strict checks are expensive.
      // We generally just trigger rebuild if it looks like a source file.
      if (shouldTriggerReindex(uri.fsPath)) requestRebuild(`fs:delete:${uri.fsPath}`)
    },
  })

  // Watch .gitignore
  const gitignorePattern = new vscode.RelativePattern(vscode.Uri.file(rootFsPath), '.gitignore')

  useFileSystemWatcher(gitignorePattern, {
    onDidCreate() {
      void reloadGitignore('gitignore:create')
    },
    onDidChange() {
      void reloadGitignore('gitignore:change')
    },
    onDidDelete() {
      gitignoreMatcher = undefined
      requestRebuild('gitignore:delete')
    },
  })
}
