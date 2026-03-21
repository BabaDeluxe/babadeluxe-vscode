import type { PinFileMessage } from '../context/types.js'
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
    const { logger, sidebar, vscode: vscodeApi, openChat, gb } = dependencies

    logger.log('[command] addFileToBabaContext called')

    const resource = toUri(args[0])
    const uri = resource ?? vscodeApi.window.activeTextEditor?.document.uri

    if (!uri) {
      logger.warn('[command] No file selected for addFileToBabaContext')
      void vscodeApi.window.showWarningMessage('No file selected.')
      return
    }

    // A/B test for add file confirmation
    const showConfirmation = gb.is('add-file-confirmation-enabled')
    if (showConfirmation) {
      const confirm = await vscodeApi.window.showInformationMessage(
        `Add ${vscodeApi.workspace.asRelativePath(uri)} to context?`,
        'Yes', 'No'
      )
      if (confirm !== 'Yes') {
        void gb.track('add-file-cancelled', { filePath: uri.fsPath })
        return
      }
    }

    logger.log('[command] Adding file to context:', uri.fsPath)
    const message: PinFileMessage = { type: 'context:pinFile', filePath: uri.fsPath }

    const postResult = await sidebar.postMessageToSidebar(message)
    if (postResult.isErr()) {
      logger.error('[command] Failed to add file to context:', postResult.error)
      void vscodeApi.window.showErrorMessage('Failed to add context.')
      void gb.track('add-file-failed', { error: postResult.error.message })
      return
    }

    void gb.track('add-file-success', {
      filePath: uri.fsPath,
      isQueued: isQueuedPostStatus(postResult.value)
    })

    logger.log('[command] File added, status:', postResult.value)
    if (postResult.isOk() && isQueuedPostStatus(postResult.value)) {
      await showQueuedContextNotice({ vscode: vscodeApi, openChat })
    }
  }
}
