/* eslint-disable @typescript-eslint/consistent-type-imports */
import type * as vscode from 'vscode'
import type { Result } from 'neverthrow'
import type { PostStatus } from '../webview/webview-pins-controller.js'
import type { SidebarWebviewNotReadyError } from '../webview/errors.js'
import type { GrowthBook } from '@growthbook/growthbook'

export type LoggerLike = typeof import('../infra/logger.js').logger

export type SidebarPostMessageResult = Result<PostStatus | undefined, SidebarWebviewNotReadyError>

export type SidebarLike = {
  postMessageToSidebar: (message: unknown) => Promise<SidebarPostMessageResult>
}

export type CommandDependencies = {
  context: vscode.ExtensionContext
  vscode: typeof import('vscode')
  logger: LoggerLike
  sidebar: SidebarLike
  openChat: () => Promise<unknown>
  gb: GrowthBook
}

export type MenuItemContribution = Readonly<{
  when?: string
  group?: string
}>

export type CommandManifest = Readonly<{
  commandId: string
  title: string
  icon?: string
  menus?: Readonly<Record<string, readonly MenuItemContribution[]>>
}>

export type ExtensionCommand = {
  run(dependencies: CommandDependencies, ...args: unknown[]): Promise<void>
}

export type LazyCommandEntry = Readonly<{
  manifest: CommandManifest
  load: () => Promise<new () => ExtensionCommand>
}>
