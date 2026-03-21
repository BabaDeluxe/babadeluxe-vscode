import { setSelectedContextRootFsPath } from '../context/storage.js'
import { isWorkspaceOpen, pickFolderUri } from './helper.js'
import type { CommandDependencies, CommandManifest, ExtensionCommand } from './types.js'

export const setContextRootManifest: CommandManifest = {
  commandId: 'babadeluxe-ai-coder.setContextRoot',
  title: 'BabaDeluxe: Set Context Root Folder',
  icon: '$(folder-opened)',
  menus: {
    'view/title': [{ when: 'view == babadeluxe-ai-coder-chat', group: 'navigation@20' }],
  },
}

export class SetContextRootCommand implements ExtensionCommand {
  async run(dependencies: CommandDependencies): Promise<void> {
    const { context, logger, vscode: vscodeApi, gb } = dependencies

    logger.log('[command] setContextRoot called')

    if (!isWorkspaceOpen(vscodeApi)) {
      void vscodeApi.window.showWarningMessage(
        'Open a workspace to save a context root. Outside a workspace, Baba uses the active file folder for manual context.'
      )
      return
    }

    const defaultUri = vscodeApi.workspace.workspaceFolders?.[0]?.uri
    if (!defaultUri) {
      void vscodeApi.window.showWarningMessage('No workspace folder found.')
      return
    }

    const uri = await pickFolderUri({
      vscode: vscodeApi,
      title: 'Select context root folder',
      openLabel: 'Use folder',
      defaultUri,
    })

    if (!uri) {
      logger.log('[command] setContextRoot cancelled by user')
      gb.track('set-context-root-cancelled')
      return
    }

    await setSelectedContextRootFsPath(context, uri.fsPath)
    logger.log('[command] Context root saved in workspaceState:', uri.fsPath)

    gb.track('set-context-root-success', { path: uri.fsPath })

    void vscodeApi.window.showInformationMessage('Context root saved for this workspace.')
  }
}
