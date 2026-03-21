import type { CommandDependencies, CommandManifest, ExtensionCommand } from './types.js'

export const openSettingsManifest: CommandManifest = {
  commandId: 'babadeluxe-ai-coder.openSettings',
  title: 'BabaDeluxe: Open Settings',
  icon: '$(gear)',
  menus: {
    'view/title': [{ when: 'view == babadeluxe-ai-coder-chat', group: 'navigation@10' }],
  },
}

export class OpenSettingsCommand implements ExtensionCommand {
  async run(dependencies: CommandDependencies): Promise<void> {
    const { logger, sidebar, vscode: vscodeApi, gb } = dependencies

    logger.log('[command] openSettings called - focusing sidebar and sending navigation message')

    await vscodeApi.commands.executeCommand('babadeluxe-ai-coder-chat.focus')

    const result = await sidebar.postMessageToSidebar({
      type: 'navigate-to',
      payload: { view: 'settings' },
    })

    if (result.isErr()) {
      logger.warn('[command] Failed to send navigation message to sidebar:', result.error.message)
      void gb.track('open-settings-failed', { error: result.error.message })
      return
    }

    void gb.track('open-settings-success')
    logger.log('[command] Settings navigation message sent successfully')
  }
}
