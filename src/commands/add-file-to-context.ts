import type { PinFileMessage } from '../types.js'
import { isQueuedPostStatus, showQueuedContextNotice, toUri } from './helper.js'
import type { CommandDependencies, CommandManifest, ExtensionCommand } from './types.js'

export const addFileToContextManifest: CommandManifest = {
  commandId: 'babadeluxe-ai-coder.context.addFileToBabaContext',
  title: 'Add File to BabaContext™',
  menus: {
    'explorer/context': [
      {
        when: '!explorerResourceIsFolder',
        group: 'navigation@50',
      },
    ],
  },
}

export class AddFileToContextCommand implements ExtensionCommand {
  async run(dependencies: CommandDependencies, ...args: unknown[]): Promise<void> {
    const { logger, sidebar, vscode, openChat } = dependencies

    // TODO Remove the manual context []
    logger.log('[command] addFileToBabaContext called')

    const resource = toUri(args[0])
    const uri = resource ?? vscode.window.activeTextEditor?.document.uri

    if (!uri) {
      logger.warn('[command] No file selected for addFileToBabaContext')
      void vscode.window.showWarningMessage('No file selected.')
      return
    }

    logger.log('[command] Adding file to context:', uri.fsPath)
    const message: PinFileMessage = { type: 'context:pinFile', filePath: uri.fsPath }

    const postResult = await sidebar.postMessageToSidebar(message)
    if (postResult.isErr()) {
      logger.error('[command] Failed to add file to context:', postResult.error)
      void vscode.window.showErrorMessage('Failed to add context.')
      return
    }

    logger.log('[command] File added, status:', postResult.value)
    if (postResult.isOk() && isQueuedPostStatus(postResult.value)) {
      await showQueuedContextNotice({ vscode, openChat })
    }
  }
}
