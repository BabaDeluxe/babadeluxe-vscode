import type { CommandDependencies, CommandManifest, ExtensionCommand } from './types.js'
import type { GitGenerateCommitMessageRequestMessage } from '../types.js'

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
    const { logger, vscode, sidebar, openChat } = dependencies

    logger.log('[command] git.generateCommitMessage called')

    // 1. Get the VS Code Git extension API (built-in, always present)
    const gitExtension = vscode.extensions.getExtension('vscode.git')
    if (!gitExtension) {
      logger.warn('[command] vscode.git extension not found')
      void vscode.window.showWarningMessage(
        'BabaDeluxe: The built-in Git extension is not available.'
      )
      return
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const gitApi = gitExtension.isActive
      ? // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        gitExtension.exports.getAPI(1)
      : // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        (await gitExtension.activate()).getAPI(1)

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const repo = gitApi?.repositories?.[0]
    if (!repo) {
      logger.warn('[command] No Git repository found')
      void vscode.window.showWarningMessage(
        'BabaDeluxe: No Git repository found in this workspace.'
      )
      return
    }

    // 2. Collect staged diff; fall back to unstaged if nothing is staged
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    let diff: string = await repo.diff(true)
    if (!diff.trim()) {
      logger.log('[command] No staged diff, falling back to unstaged diff')
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      diff = await repo.diff(false)
    }

    if (!diff.trim()) {
      void vscode.window.showWarningMessage(
        'BabaDeluxe: No changes detected. Stage or modify files first.'
      )
      return
    }

    // Truncate very large diffs to avoid overwhelming the model
    const MAX_DIFF_CHARS = 12_000
    const truncatedDiff =
      diff.length > MAX_DIFF_CHARS
        ? `${diff.slice(0, MAX_DIFF_CHARS)}\n... [diff truncated]`
        : diff

    logger.log(`[command] Sending staged diff to sidebar (${truncatedDiff.length} chars)`)

    // 3. Ask the sidebar (webview / AI layer) to generate the commit message
    const message: GitGenerateCommitMessageRequestMessage = {
      type: 'git:generateCommitMessage',
      diff: truncatedDiff,
    }

    const postResult = await sidebar.postMessageToSidebar(message)
    if (postResult.isErr()) {
      logger.error('[command] Failed to post to sidebar:', postResult.error)
      void vscode.window.showErrorMessage(
        'BabaDeluxe: Could not reach the chat sidebar. Open the BabaDeluxe panel first.'
      )
      return
    }

    logger.log('[command] git.generateCommitMessage request sent, status:', postResult.value)

    // 4. Open chat so the user sees the generated message
    await openChat()
  }
}
