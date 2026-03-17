import * as vscode from 'vscode'
import { key, section } from './constants.js'

function normalize(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined
  const trimmed = v.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

/**
 * Reads babadeluxe-ai-coder.contextRoot.
 * If scopeUri is provided, resource-scoped settings can apply.
 */
export function resolveContextRootFsPath(scopeUri?: vscode.Uri): string | undefined {
  const cfg = vscode.workspace.getConfiguration(section, scopeUri)
  return normalize(cfg.get<string | undefined>(key))
}

// Export async function setContextRootFsPath(
//   RootFsPath: string,
//   ScopeUri?: vscode.Uri
// ): Promise<void> {
//   Const cfg = vscode.workspace.getConfiguration(SECTION, scopeUri)
//   Await cfg.update(KEY, rootFsPath, vscode.ConfigurationTarget.Workspace)
// }

// Export async function clearContextRootFsPath(scopeUri?: vscode.Uri): Promise<void> {
//   Const cfg = vscode.workspace.getConfiguration(SECTION, scopeUri)
//   Await cfg.update(KEY, undefined, vscode.ConfigurationTarget.Workspace)
// }
