import process from 'node:process'
import PQueue from 'p-queue'
import { maxFolderPinFiles } from '../constants.js'
import { scanFolderForIndexableFiles } from '../fs-utils.js'
import type { CommandDependencies, CommandManifest, ExtensionCommand } from './types.js'
import { isQueuedPostStatus, pickFolderUri, showQueuedContextNotice, toUri } from './helper.js'

export const addFolderToContextManifest: CommandManifest = {
  commandId: 'babadeluxe-ai-coder.context.addFolderToBabaContext',
  title: 'Add Folder to BabaContext™',
  menus: {
    'explorer/context': [
      {
        when: 'explorerResourceIsFolder',
        group: 'navigation@50',
      },
    ],
  },
}

export class AddFolderToContextCommand implements ExtensionCommand {
  async run(dependencies: CommandDependencies, ...args: unknown[]): Promise<void> {
    const { logger, sidebar, vscode, openChat } = dependencies

    logger.log('[command] addFolderToBabaContext called')

    const folderUriArgument = toUri(args[0])
    let effectiveFolderUri = folderUriArgument

    if (!effectiveFolderUri) {
      const defaultUri =
        vscode.window.activeTextEditor?.document.uri ?? vscode.Uri.file(process.cwd())

      effectiveFolderUri = await pickFolderUri({
        vscode,
        title: 'Select folder to pin',
        openLabel: 'Pin folder',
        defaultUri,
      })
    }

    if (!effectiveFolderUri) {
      void vscode.window.showWarningMessage('No folder selected.')
      return
    }

    const stat = await vscode.workspace.fs.stat(effectiveFolderUri)
    if (stat.type !== vscode.FileType.Directory) {
      void vscode.window.showErrorMessage('Selected resource is not a folder.')
      return
    }

    logger.log('[command] Scanning folder:', effectiveFolderUri.fsPath)
    const scanResult = await scanFolderForIndexableFiles({
      rootFolderUri: effectiveFolderUri,
      maxFiles: maxFolderPinFiles + 1,
    })

    if (scanResult.isErr()) {
      logger.error('[command] Folder scan failed:', scanResult.error)
      void vscode.window.showErrorMessage('Failed to scan folder.')
      return
    }

    const scan = scanResult.value
    logger.log('[command] Found', scan.fileUris.length, 'files, maxDepth:', scan.maxDepth)

    if (scan.fileUris.length === 0) {
      void vscode.window.showInformationMessage('No indexable files found in folder.')
      return
    }

    if (scan.maxDepth > 2) {
      const choice = await vscode.window.showWarningMessage(
        `This folder is nested (depth ${scan.maxDepth}). Pinning may add a lot of context. Continue?`,
        { modal: true },
        'Pin folder',
        'Cancel'
      )
      if (choice !== 'Pin folder') return
    }

    if (scan.wasCapped) {
      const choice = await vscode.window.showWarningMessage(
        `More than ${maxFolderPinFiles} indexable files found. Pin only the first ${maxFolderPinFiles}?`,
        { modal: true },
        `Pin ${maxFolderPinFiles}`,
        'Cancel'
      )
      if (choice !== `Pin ${maxFolderPinFiles}`) return
    }

    const fileUris = scan.fileUris.slice(0, maxFolderPinFiles)
    const queue = new PQueue({ concurrency: 4 })
    const queuedResults: boolean[] = []
    const taskPromises: Array<Promise<void>> = []

    for (const fileUri of fileUris) {
      const taskIndex = taskPromises.length

      taskPromises.push(
        queue.add(async () => {
          const postResult = await sidebar.postMessageToSidebar({
            type: 'context:pinFile',
            filePath: fileUri.fsPath,
          })

          if (postResult.isOk() && isQueuedPostStatus(postResult.value)) {
            queuedResults[taskIndex] = true
          }
        })
      )
    }

    await Promise.race([queue.onError(), queue.onIdle()])
    await Promise.allSettled(taskPromises)

    logger.log('[command] Pinned', fileUris.length, 'files from folder')
    void vscode.window.showInformationMessage(`Pinned ${fileUris.length} files from folder.`)

    const sawQueued = queuedResults.includes(true)
    if (sawQueued) {
      await showQueuedContextNotice({ vscode, openChat })
    }
  }
}
