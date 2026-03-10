import type * as vscode from 'vscode'

const selectedContextRootKey = 'selectedContextRootFsPath'

export function normalizeFsPath(value: string | undefined): string | undefined {
  if (!value) return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

export function normalizeFileKey(filePath: string): string {
  const trimmed = filePath.trim()
  const normalizedSlashes = trimmed.replaceAll('\\', '/')
  const lowerCased = normalizedSlashes.toLowerCase()
  return lowerCased
}

export function getSelectedContextRootFsPath(context: vscode.ExtensionContext): string | undefined {
  return normalizeFsPath(context.workspaceState.get<string>(selectedContextRootKey))
}

export async function setSelectedContextRootFsPath(
  context: vscode.ExtensionContext,
  fsPath: string
): Promise<void> {
  await context.workspaceState.update(selectedContextRootKey, fsPath)
}

export async function clearSelectedContextRootFsPath(
  context: vscode.ExtensionContext
): Promise<void> {
  await context.workspaceState.update(selectedContextRootKey, undefined)
}
