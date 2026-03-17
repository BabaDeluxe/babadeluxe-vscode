/* eslint-disable @typescript-eslint/consistent-type-imports */
import { type Result, err, ok } from 'neverthrow'
import { ContextCommandError } from '../errors.js'
import type { PinSnippetMessage, TextRange } from '../types.js'
import type { CommandDependencies, CommandManifest, ExtensionCommand } from './types.js'
import { isQueuedPostStatus, showQueuedContextNotice } from './helper.js'

const makeId = (): string => `${Date.now()}-${Math.random().toString(16).slice(2)}`

function selectionToRange(editor: import('vscode').TextEditor): TextRange {
  const { selection } = editor

  return {
    startLine: selection.start.line,
    startCharacter: selection.start.character,
    endLine: selection.end.line,
    endCharacter: selection.end.character,
  }
}

function getSelectionSnippet(
  vscode: typeof import('vscode')
): Result<{ filePath: string; snippet: string; range: TextRange }, ContextCommandError> {
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

export const addSelectionToContextManifest: CommandManifest = {
  commandId: 'babadeluxe-ai-coder.context.addSelectionToBabaContext',
  title: 'Add Code to BabaContext™',
  menus: {
    'editor/context': [{ when: 'editorHasSelection', group: 'navigation@50' }],
  },
}

export class AddSelectionToContextCommand implements ExtensionCommand {
  async run(dependencies: CommandDependencies): Promise<void> {
    const { logger, sidebar, vscode, openChat } = dependencies

    logger.log('[command] addSelectionToBabaContext called')

    const selectionResult = getSelectionSnippet(vscode)
    if (selectionResult.isErr()) {
      logger.error('[command] Failed to get selection:', selectionResult.error)
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

    logger.log('[command] Adding snippet to context')
    const postResult = await sidebar.postMessageToSidebar(message)
    if (postResult.isErr()) {
      logger.error('[command] Failed to add snippet to context:', postResult.error)
      void vscode.window.showErrorMessage('Failed to add context.')
      return
    }

    if (postResult.isOk() && isQueuedPostStatus(postResult.value)) {
      await showQueuedContextNotice({ vscode, openChat })
    }
  }
}
