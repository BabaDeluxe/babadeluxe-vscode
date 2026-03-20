import { clearSelectedContextRootFsPath } from '../context/context-root-storage.js'
import { isWorkspaceOpen } from './helper.js'
import type { CommandDependencies, CommandManifest, ExtensionCommand } from './types.js'

export const clearContextRootManifest: CommandManifest = {
  commandId: 'babadeluxe-ai-coder.clearContextRoot',
  title: 'BabaDeluxe: Clear Context Root Folder',
  icon: '$(clear-all)',
  menus: {
    'view/title': [{ when: 'view == babadeluxe-ai-coder-chat', group: 'navigation@30' }],
  },
}

export class ClearContextRootCommand implements ExtensionCommand {
  async run(dependencies: CommandDependencies): Promise<void> {
    const { context, logger, vscode: vscodeApi, gb } = dependencies

    logger.log('[command] clearContextRoot called')

    if (!isWorkspaceOpen(vscodeApi)) {
      void vscodeApi.window.showInformationMessage('No workspace open; nothing to clear.')
      return
    }

    await clearSelectedContextRootFsPath(context)
    logger.log('[command] Context root cleared from workspaceState')

    gb.track('clear-context-root-success')

    void vscodeApi.window.showInformationMessage('Context root cleared for this workspace.')
  }
}
