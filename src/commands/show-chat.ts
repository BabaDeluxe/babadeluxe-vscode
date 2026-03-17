import type { CommandDependencies, CommandManifest, ExtensionCommand } from './types.js'

export const showChatManifest: CommandManifest = {
  commandId: 'babadeluxe-ai-coder.showChat',
  title: 'BabaDeluxe: Show Chat',
  icon: '$(comment-discussion)',
}

export class ShowChatCommand implements ExtensionCommand {
  async run(dependencies: CommandDependencies): Promise<void> {
    dependencies.logger.log('[command] showChat called')
    await dependencies.openChat()
  }
}
