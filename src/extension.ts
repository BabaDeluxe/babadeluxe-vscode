import process from 'node:process'
import * as vscode from 'vscode'
import { err, ok, type Result } from 'neverthrow'
import { ChatPanelManager } from './chat-panel-manager.js'
import { logger } from './logger.js'
import { BabaDeluxeWebviewProvider } from './baba-deluxe-webview-provider.js'
import { SupabaseOAuthController } from './supabase-oauth-controller.js'
import { section, key } from './constants.js'
import { ContextCommandError } from './errors.js'
import type { PinFileMessage, PinSnippetMessage, TextRange } from './types.js'

const makeId = (): string => `${Date.now()}-${Math.random().toString(16).slice(2)}`

function getBestTarget(scopeUri?: vscode.Uri): vscode.ConfigurationTarget {
  const hasWorkspace = Boolean(vscode.workspace.workspaceFolders?.length)
  if (!hasWorkspace) return vscode.ConfigurationTarget.Global

  const folder = scopeUri ? vscode.workspace.getWorkspaceFolder(scopeUri) : undefined
  return folder ? vscode.ConfigurationTarget.WorkspaceFolder : vscode.ConfigurationTarget.Workspace
}

function selectionToRange(editor: vscode.TextEditor): TextRange {
  const { selection } = editor

  return {
    startLine: selection.start.line,
    startCharacter: selection.start.character,
    endLine: selection.end.line,
    endCharacter: selection.end.character,
  }
}

function getSelectionSnippet(): Result<
  { filePath: string; snippet: string; range: TextRange },
  ContextCommandError
> {
  const editor = vscode.window.activeTextEditor
  if (!editor) return err(new ContextCommandError('No active editor.'))

  const { selection } = editor
  if (selection.isEmpty) return err(new ContextCommandError('No text selected.'))

  const snippet = editor.document.getText(selection)
  if (snippet.trim().length === 0) return err(new ContextCommandError('Selection is empty.'))

  const filePath = editor.document.uri.fsPath
  if (!filePath) return err(new ContextCommandError('Active editor has no file path.'))

  return ok({ filePath, snippet, range: selectionToRange(editor) })
}

async function showQueuedContextNotice(openChat: () => Promise<void>): Promise<void> {
  const choice = await vscode.window.showInformationMessage(
    'Context added. Open BabaDeluxe Chat to use it.',
    'Open Chat'
  )

  if (choice === 'Open Chat') {
    await openChat()
  }
}

export function activate(context: vscode.ExtensionContext): void {
  const supabaseOAuthController = new SupabaseOAuthController(context, logger)

  const chatPanelManager = new ChatPanelManager(context, context.extensionUri)
  const provider = new BabaDeluxeWebviewProvider(
    context,
    context.extensionUri,
    supabaseOAuthController
  )

  const openChat = async (): Promise<void> => {
    await vscode.commands.executeCommand('babadeluxe-ai-coder.showChat')
  }

  context.subscriptions.push(
    supabaseOAuthController,
    provider,

    vscode.window.registerUriHandler({
      async handleUri(uri: vscode.Uri): Promise<void> {
        logger.log('URI handler got:', uri.toString())
        const result = await supabaseOAuthController.handleAuthCallback(uri)
        if (result.isErr()) {
          logger.warn('Auth callback failed:', result.error.message)
          void vscode.window.showErrorMessage(result.error.message)
        }
      },
    }),

    vscode.window.registerWebviewViewProvider('babadeluxe-ai-coder-panel', provider),

    vscode.commands.registerCommand('babadeluxe-ai-coder.showChat', async () => {
      logger.log('registering chat panel')
      await chatPanelManager.createChatPanel()
    }),

    vscode.commands.registerCommand('babadeluxe-ai-coder.setContextRoot', async () => {
      const scopeUri = vscode.window.activeTextEditor?.document.uri
      const defaultUri =
        vscode.workspace.workspaceFolders?.[0]?.uri ?? vscode.Uri.file(process.cwd())

      const picked = await vscode.window.showOpenDialog({
        title: 'Select context root folder',
        openLabel: 'Use folder',
        canSelectMany: false,
        canSelectFiles: false,
        canSelectFolders: true,
        defaultUri,
      })

      const uri = picked?.[0]
      if (!uri) return

      const cfg = vscode.workspace.getConfiguration(section, scopeUri)
      const target = getBestTarget(scopeUri)

      await cfg.update(key, uri.fsPath, target)

      void vscode.window.showInformationMessage(
        target === vscode.ConfigurationTarget.Global
          ? 'Context root set in User settings (no workspace open).'
          : 'Context root set in Workspace settings.'
      )
    }),

    vscode.commands.registerCommand('babadeluxe-ai-coder.clearContextRoot', async () => {
      const scopeUri = vscode.window.activeTextEditor?.document.uri
      const cfg = vscode.workspace.getConfiguration(section, scopeUri)
      const target = getBestTarget(scopeUri)

      await cfg.update(key, undefined, target)

      void vscode.window.showInformationMessage(
        target === vscode.ConfigurationTarget.Global
          ? 'Context root cleared from User settings.'
          : 'Context root cleared from Workspace settings.'
      )
    }),

    vscode.commands.registerCommand('babadeluxe-ai-coder.openSettings', async () => {
      const query = '@ext:babadeluxe.babadeluxe-vscode'

      if (vscode.workspace.workspaceFolders?.length) {
        await vscode.commands.executeCommand('workbench.action.openWorkspaceSettings', query)
        return
      }

      await vscode.commands.executeCommand('workbench.action.openSettings', query)
    }),

    vscode.commands.registerCommand(
      'babadeluxe-ai-coder.context.addFileToBabaContext',
      async (resource?: vscode.Uri) => {
        const uri = resource ?? vscode.window.activeTextEditor?.document.uri
        if (!uri) {
          logger.error('AddFileToBabaContext failed: no resource and no active editor.')
          void vscode.window.showErrorMessage('No file selected.')
          return
        }

        const message: PinFileMessage = { type: 'context:pinFile', filePath: uri.fsPath }

        const postResult = await provider.postMessageToSidebar(message)
        if (postResult.isErr()) {
          logger.error('AddFileToBabaContext failed:', postResult.error)
          void vscode.window.showErrorMessage('Failed to add context.')
          return
        }

        if (postResult.value.kind === 'queued') {
          await showQueuedContextNotice(openChat)
        }
      }
    ),

    vscode.commands.registerCommand(
      'babadeluxe-ai-coder.context.addSelectionToBabaContext',
      async () => {
        const selectionResult = getSelectionSnippet()
        if (selectionResult.isErr()) {
          logger.error('AddSelectionToBabaContext failed:', selectionResult.error)
          void vscode.window.showErrorMessage(selectionResult.error.message)
          return
        }

        const message: PinSnippetMessage = {
          type: 'context:pinSnippet',
          id: makeId(),
          filePath: selectionResult.value.filePath,
          range: selectionResult.value.range,
          snippet: selectionResult.value.snippet,
        }

        const postResult = await provider.postMessageToSidebar(message)
        if (postResult.isErr()) {
          logger.error('AddSelectionToBabaContext failed:', postResult.error)
          void vscode.window.showErrorMessage('Failed to add context.')
          return
        }

        if (postResult.value.kind === 'queued') {
          await showQueuedContextNotice(openChat)
        }
      }
    )
  )

  logger.log('BabaDeluxe AI Coder extension activated')
}

export function deactivate(): void {
  logger.log('Extension deactivated')
}
