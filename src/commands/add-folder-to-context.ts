import process from 'node:process'
import PQueue from 'p-queue'
import { maxFolderPinFiles } from '../infra/constants.js'
import { scanFolderForIndexableFiles } from '../infra/fs-utils.js'
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
    const { logger, sidebar, vscode: vscodeApi, openChat, gb } = dependencies

    logger.log('[command] addFolderToBabaContext called')

    const folderUriArgument = toUri(args[0])
    let effectiveFolderUri = folderUriArgument

    if (!effectiveFolderUri) {
      const defaultUri =
        vscodeApi.window.activeTextEditor?.document.uri ?? vscodeApi.Uri.file(process.cwd())

      effectiveFolderUri = await pickFolderUri({
        vscode: vscodeApi,
        title: 'Select folder to pin',
        openLabel: 'Pin folder',
        defaultUri,
      })
    }

    if (!effectiveFolderUri) {
      void vscodeApi.window.showWarningMessage('No folder selected.')
      return
    }

    const stat = await vscodeApi.workspace.fs.stat(effectiveFolderUri)
    if (stat.type !== vscodeApi.FileType.Directory) {
      void vscodeApi.window.showErrorMessage('Selected resource is not a folder.')
      return
    }

    logger.log('[command] Scanning folder:', effectiveFolderUri.fsPath)
    const scanResult = await scanFolderForIndexableFiles({
      rootFolderUri: effectiveFolderUri,
      maxFiles: maxFolderPinFiles + 1,
    })

    if (scanResult.isErr()) {
      logger.error('[command] Folder scan failed:', scanResult.error)
      void vscodeApi.window.showErrorMessage('Failed to scan folder.')
      gb.track('add-folder-scan-failed', { error: scanResult.error.message })
      return
    }

    const scan = scanResult.value
    logger.log('[command] Found', scan.fileUris.length, 'files, maxDepth:', scan.maxDepth)

    if (scan.fileUris.length === 0) {
      void vscodeApi.window.showInformationMessage('No indexable files found in folder.')
      gb.track('add-folder-empty', { folderPath: effectiveFolderUri.fsPath })
      return
    }

    if (scan.maxDepth > 2) {
      const choice = await vscodeApi.window.showWarningMessage(
        `This folder is nested (depth ${scan.maxDepth}). Pinning may add a lot of context. Continue?`,
        { modal: true },
        'Pin folder',
        'Cancel'
      )
      if (choice !== 'Pin folder') {
        gb.track('add-folder-cancelled-depth', { depth: scan.maxDepth })
        return
      }
    }

    if (scan.wasCapped) {
      const choice = await vscodeApi.window.showWarningMessage(
        `More than ${maxFolderPinFiles} indexable files found. Pin only the first ${maxFolderPinFiles}?`,
        { modal: true },
        `Pin ${maxFolderPinFiles}`,
        'Cancel'
      )
      if (choice !== `Pin ${maxFolderPinFiles}`) {
        gb.track('add-folder-cancelled-capped', { count: scan.fileUris.length })
        return
      }
    }

    const fileUris = scan.fileUris.slice(0, maxFolderPinFiles)
    const queue = new PQueue({ concurrency: 4 })
    const queuedResults: boolean[] = []
    const taskPromises: Array<Promise<void>> = []

    for (const fileUri of fileUris) {
      const taskIndex = taskPromises.length

      const task = async () => {
        const postResult = await sidebar.postMessageToSidebar({
          type: 'context:pinFile',
          filePath: fileUri.fsPath,
        })

        if (postResult.isOk() && isQueuedPostStatus(postResult.value)) {
          queuedResults[taskIndex] = true
        }
      }
      taskPromises.push(queue.add(task))
    }

    await Promise.race([queue.onIdle()])
    await Promise.allSettled(taskPromises)

    gb.track('add-folder-success', {
      folderPath: effectiveFolderUri.fsPath,
      fileCount: fileUris.length
    })

    logger.log('[command] Pinned', fileUris.length, 'files from folder')
    void vscodeApi.window.showInformationMessage(`Pinned ${fileUris.length} files from folder.`)

    const sawQueued = queuedResults.includes(true)
    if (sawQueued) {
      await showQueuedContextNotice({ vscode: vscodeApi, openChat })
    }
  }
}
