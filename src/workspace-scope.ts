import * as path from 'node:path'
import * as vscode from 'vscode'

export function isContextRootInsideWorkspace(contextRootFsPath: string): boolean {
  const folders = vscode.workspace.workspaceFolders
  if (!folders || folders.length === 0) return false

  const normalizedRoot = path.resolve(contextRootFsPath)

  for (const folder of folders) {
    const folderFsPath = path.resolve(folder.uri.fsPath)
    const relative = path.relative(folderFsPath, normalizedRoot)

    const isInside =
      relative.length === 0 || (!relative.startsWith('..') && !path.isAbsolute(relative))

    if (isInside) return true
  }

  return false
}
