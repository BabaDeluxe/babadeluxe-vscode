/* eslint-disable @typescript-eslint/consistent-type-imports */
import type * as vscode from 'vscode'
import type { PostStatus } from '../webview-pins-controller.js'

export function isWorkspaceOpen(vscodeApi: typeof import('vscode')): boolean {
  return Boolean(vscodeApi.workspace.workspaceFolders?.length)
}

export async function showQueuedContextNotice(options: {
  vscode: typeof import('vscode')
  openChat: () => Promise<unknown>
}): Promise<void> {
  const choice = await options.vscode.window.showInformationMessage(
    'Context added. Open BabaDeluxe Chat to use it.',
    'Open Chat'
  )

  if (choice === 'Open Chat') await options.openChat()
}

export async function pickFolderUri(options: {
  vscode: typeof import('vscode')
  title: string
  openLabel: string
  defaultUri: vscode.Uri
}): Promise<vscode.Uri | undefined> {
  const picked = await options.vscode.window.showOpenDialog({
    title: options.title,
    openLabel: options.openLabel,
    canSelectMany: false,
    canSelectFiles: false,
    canSelectFolders: true,
    defaultUri: options.defaultUri,
  })

  return picked?.[0]
}

export function toUri(value: unknown): vscode.Uri | undefined {
  if (!value || typeof value !== 'object') return undefined

  const candidate = value as { fsPath?: unknown; scheme?: unknown }
  if (typeof candidate.fsPath === 'string' && typeof candidate.scheme === 'string') {
    return value as vscode.Uri
  }

  return undefined
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

export function isQueuedPostStatus(value: PostStatus | undefined): boolean {
  if (!value) return false
  if (!isRecord(value)) return false
  return value.kind === 'queued'
}
