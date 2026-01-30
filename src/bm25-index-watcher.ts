import * as vscode from 'vscode'
import type { Ignore } from 'ignore'
import { ignoredDirectories } from './constants.js'
import { indexableFileWatcherGlob, isIndexableFileExtension } from './indexable-file-extensions.js'
import { loadRootGitignore, isIgnoredByRootGitignore } from './root-gitignore.js'
import { logger } from './logger.js'

function toSlashPath(fsPath: string): string {
  return fsPath.replaceAll('\\', '/')
}

function isInsideIgnoredDirectory(fileFsPath: string): boolean {
  const slashPath = toSlashPath(fileFsPath)

  for (const directoryName of ignoredDirectories) {
    if (slashPath.includes(`/${directoryName}/`)) return true
  }

  return false
}

export function createBm25IndexWatcher(
  rootFsPath: string,
  requestRebuild: (reason: string) => void
): vscode.Disposable {
  let gitignoreMatcher: Ignore | undefined

  const reloadGitignore = async (reason: string): Promise<void> => {
    const result = await loadRootGitignore(rootFsPath)
    if (result.isErr()) {
      logger.warn(`[bm25] Failed to load .gitignore: ${result.error.message}`)
      gitignoreMatcher = undefined
      return
    }

    gitignoreMatcher = result.value
    requestRebuild(reason)
  }

  // Fast startup: don’t await; until loaded, treat as “not ignored”.
  void reloadGitignore('gitignore:startup')

  const shouldTriggerReindex = (fileFsPath: string): boolean => {
    if (isInsideIgnoredDirectory(fileFsPath) || !isIndexableFileExtension(fileFsPath)) return false

    const matcher = gitignoreMatcher
    if (!matcher) return true

    return !isIgnoredByRootGitignore(rootFsPath, matcher, fileFsPath)
  }

  const filePattern = new vscode.RelativePattern(
    vscode.Uri.file(rootFsPath),
    indexableFileWatcherGlob
  )
  const fileWatcher = vscode.workspace.createFileSystemWatcher(filePattern)

  const gitignoreWatcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(vscode.Uri.file(rootFsPath), '.gitignore')
  )

  let debounceTimer: NodeJS.Timeout | undefined

  const schedule = (uri: vscode.Uri, kind: 'create' | 'change' | 'delete'): void => {
    if (!shouldTriggerReindex(uri.fsPath)) return

    if (debounceTimer) clearTimeout(debounceTimer)

    debounceTimer = setTimeout(() => {
      debounceTimer = undefined
      requestRebuild(`fs:${kind}:${uri.fsPath}`)
    }, 10_000)
  }

  const subscriptions: vscode.Disposable[] = [
    fileWatcher,

    fileWatcher.onDidCreate((uri) => {
      schedule(uri, 'create')
    }),
    fileWatcher.onDidChange((uri) => {
      schedule(uri, 'change')
    }),
    fileWatcher.onDidDelete((uri) => {
      schedule(uri, 'delete')
    }),

    gitignoreWatcher,
    gitignoreWatcher.onDidCreate(() => {
      void reloadGitignore('gitignore:create')
    }),
    gitignoreWatcher.onDidChange(() => {
      void reloadGitignore('gitignore:change')
    }),
    gitignoreWatcher.onDidDelete(() => {
      gitignoreMatcher = undefined
      requestRebuild('gitignore:delete')
    }),

    {
      dispose() {
        if (debounceTimer) clearTimeout(debounceTimer)
        debounceTimer = undefined
      },
    },
  ]

  return vscode.Disposable.from(...subscriptions)
}
