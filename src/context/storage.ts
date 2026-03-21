import type * as vscode from 'vscode'

const contextRootKey = 'babadeluxe-ai-coder.contextRoot'

export function getSelectedContextRootFsPath(context: vscode.ExtensionContext): string | undefined {
  return context.workspaceState.get<string>(contextRootKey)
}

export async function setSelectedContextRootFsPath(
  context: vscode.ExtensionContext,
  fsPath: string
): Promise<void> {
  await context.workspaceState.update(contextRootKey, fsPath)
}

export async function clearSelectedContextRootFsPath(
  context: vscode.ExtensionContext
): Promise<void> {
  await context.workspaceState.update(contextRootKey, undefined)
}
