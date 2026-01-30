import * as path from 'node:path'
import * as vscode from 'vscode'
import type { FileSignalProvider, FileSignals } from './types.js'

function uniquePreserveOrder(values: readonly string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    if (seen.has(value)) continue
    seen.add(value)
    result.push(value)
  }

  return result
}

export class VsCodeSignalProvider implements FileSignalProvider {
  private readonly _editedFiles = new Set<string>()

  public constructor(private readonly _workspaceRoot: string) {
    this._watchFileEdits()
  }

  public listHotFilePaths(): readonly string[] {
    const active = vscode.window.activeTextEditor?.document.uri.fsPath
    const open = vscode.window.visibleTextEditors.map((editor) => editor.document.uri.fsPath)
    const edited = [...this._editedFiles]

    return uniquePreserveOrder(
      [active, ...open, ...edited].filter((value): value is string => typeof value === 'string')
    )
  }

  public getSignalsForFile(filePath: string): FileSignals {
    const targetFsPath = path.isAbsolute(filePath)
      ? filePath
      : path.join(this._workspaceRoot, filePath)

    const activeFsPath = vscode.window.activeTextEditor?.document.uri.fsPath

    const isActive = activeFsPath === targetFsPath

    const isOpen = vscode.window.visibleTextEditors.some(
      (editor) => editor.document.uri.fsPath === targetFsPath
    )

    const sameDirAsActive =
      activeFsPath === undefined ? false : path.dirname(activeFsPath) === path.dirname(targetFsPath)

    return {
      isActive,
      isOpen,
      wasEditedThisSession: this._editedFiles.has(targetFsPath),
      sameDirAsActive,
      importsActive: false,
      importedByActive: false,
      recentlyTouchedInGit: false,
    }
  }

  private _watchFileEdits(): void {
    vscode.workspace.onDidChangeTextDocument((event) => {
      this._editedFiles.add(event.document.uri.fsPath)
    })
  }
}
