/* eslint-disable @typescript-eslint/consistent-type-imports */
import { type Result, err, ok } from 'neverthrow'
import { ContextCommandError } from '../errors.js'
import type { PinSnippetMessage, TextRange } from '../types.js'
import type { CommandDependencies, CommandManifest, ExtensionCommand } from './types.js'
import { isQueuedPostStatus, showQueuedContextNotice } from './helper.js'

const makeId = (): string => `ask-${Date.now()}-${Math.random().toString(16).slice(2)}`

function selectionToRange(editor: import('vscode').TextEditor): TextRange {
  const { selection } = editor
  return {
    startLine: selection.start.line,
    startCharacter: selection.start.character,
    endLine: selection.end.line,
    endCharacter: selection.end.character,
  }
}

function getSelectionPayload(
  vscode: typeof import('vscode'),
): Result<{ filePath: string; snippet: string; range: TextRange }, ContextCommandError> {
  const editor = vscode.window.activeTextEditor
  if (!editor) return err(new ContextCommandError('No active editor.'))

  const { selection } = editor
  if (selection.isEmpty) return err(new ContextCommandError('No text selected.'))

  const snippet = editor.document.getText(selection)
  if (snippet.trim().length === 0) return err(new ContextCommandError('Selection is whitespace only.'))

  const filePath = editor.document.uri.fsPath
  if (!filePath) return err(new ContextCommandError('Active editor has no file path.'))

  return ok({ filePath, snippet, range: selectionToRange(editor) })
}

export const askWithSelectionManifest: CommandManifest = {
  commandId: 'babadeluxe-ai-coder.context.askWithSelection',
  title: 'Ask BabaDeluxe about Selection',
  menus: {
    'editor/context': [{ when: 'editorHasSelection', group: 'navigation@49' }],
  },
}

export class AskWithSelectionCommand implements ExtensionCommand {
  async run(dependencies: CommandDependencies): Promise<void> {
    const { logger, sidebar, vscode, openChat } = dependencies

    logger.log('[command] askWithSelection called')

    const selectionResult = getSelectionPayload(vscode)
    if (selectionResult.isErr()) {
      logger.error('[command] Failed to get selection:', selectionResult.error)
      void vscode.window.showErrorMessage(selectionResult.error.message)
      return
    }

    // Pin the selection as a snippet (reuses existing context:pinSnippet path)
    const pinMessage: PinSnippetMessage = {
      type: 'context:pinSnippet',
      id: makeId(),
      filePath: selectionResult.value.filePath,
      range: selectionResult.value.range,
      snippet: selectionResult.value.snippet,
    }

    logger.log('[command] Pinning selection snippet')
    const postResult = await sidebar.postMessageToSidebar(pinMessage)
    if (postResult.isErr()) {
      logger.error('[command] Failed to pin snippet:', postResult.error)
      void vscode.window.showErrorMessage('Failed to add selection to context.')
      return
    }

    if (isQueuedPostStatus(postResult.value)) {
      await showQueuedContextNotice({ vscode, openChat })
      return
    }

    // Focus the sidebar panel so the user lands in the chat immediately
    logger.log('[command] Focusing sidebar after ask-with-selection')
    await openChat()
  }
}
