import type { CommandDependencies, CommandManifest, ExtensionCommand } from './types.js'

export const generateCommitMessageManifest: CommandManifest = {
  commandId: 'babadeluxe-ai-coder.git.generateCommitMessage',
  title: 'BabaDeluxe: Generate Commit Message',
  icon: '$(sparkle)',
  menus: {
    'scm/title': [{ when: 'scmProvider == git', group: 'navigation@10' }],
  },
}

export class GenerateCommitMessageCommand implements ExtensionCommand {
  async run(dependencies: CommandDependencies): Promise<void> {
    const { logger, vscode, gb } = dependencies

    logger.error('[command] git.generateCommitMessage is not implemented yet.')
    void vscode.window.showErrorMessage('Generate Commit Message is not implemented yet.')

    gb.track('generate-commit-message-not-implemented')

    throw new Error('Not implemented: babadeluxe-ai-coder.git.generateCommitMessage')
  }
}
