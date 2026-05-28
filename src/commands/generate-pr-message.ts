import type { CommandDependencies, CommandManifest, ExtensionCommand } from './types.js'
import type { GitGeneratePrMessageRequestMessage } from '../types.js'

export const generatePrMessageManifest: CommandManifest = {
  commandId: 'babadeluxe-ai-coder.git.generatePrMessage',
  title: 'BabaDeluxe: Generate PR Title & Description',
  icon: '$(sparkle)',
  menus: {
    // Shown in the Source Control title bar alongside the commit message button
    'scm/title': [{ when: 'scmProvider == git', group: 'navigation@11' }],
  },
}

const MAX_DIFF_CHARS = 16_000
const MAX_COMMITS = 20

export class GeneratePrMessageCommand implements ExtensionCommand {
  async run(dependencies: CommandDependencies): Promise<void> {
    const { logger, vscode, sidebar, openChat } = dependencies

    logger.log('[command] git.generatePrMessage called')

    // 1. Get the VS Code Git extension API
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

    // 2. Determine base branch (default remote branch or main/master fallback)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const HEAD = repo.state?.HEAD
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const currentBranch: string = HEAD?.name ?? 'HEAD'
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const upstream: string | undefined = HEAD?.upstream?.name

    // Resolve base: prefer upstream tracking branch, fall back to common defaults
    const baseBranch = upstream ?? (await resolveBaseBranch(repo, logger))

    if (!baseBranch) {
      void vscode.window.showWarningMessage(
        'BabaDeluxe: Could not determine a base branch for comparison. Push your branch or set an upstream first.'
      )
      return
    }

    logger.log(`[command] Comparing ${currentBranch} against ${baseBranch}`)

    // 3. Collect diff between base and HEAD
    let diff = ''
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      diff = await repo.diffBetween(baseBranch, currentBranch)
    } catch (error) {
      logger.warn('[command] diffBetween failed, falling back to current diff:', String(error))
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      diff = await repo.diff(false)
    }

    if (!diff.trim()) {
      void vscode.window.showWarningMessage(
        `BabaDeluxe: No diff found between '${baseBranch}' and '${currentBranch}'.`
      )
      return
    }

    const truncatedDiff =
      diff.length > MAX_DIFF_CHARS
        ? `${diff.slice(0, MAX_DIFF_CHARS)}\n... [diff truncated]`
        : diff

    // 4. Collect recent commit messages on this branch
    let commitMessages: string[] = []
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const log = await repo.log({ maxEntries: MAX_COMMITS })
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      commitMessages = (log as Array<{ message: string }>)
        .map((c) => c.message.split('\n')[0]?.trim() ?? '')
        .filter(Boolean)
    } catch (error) {
      logger.warn('[command] Could not retrieve commit log:', String(error))
    }

    logger.log(
      `[command] Sending PR context to sidebar (diff: ${truncatedDiff.length} chars, commits: ${commitMessages.length})`
    )

    // 5. Send to sidebar for AI generation
    const message: GitGeneratePrMessageRequestMessage = {
      type: 'git:generatePrMessage',
      baseBranch,
      currentBranch,
      diff: truncatedDiff,
      commitMessages,
    }

    const postResult = await sidebar.postMessageToSidebar(message)
    if (postResult.isErr()) {
      logger.error('[command] Failed to post to sidebar:', postResult.error)
      void vscode.window.showErrorMessage(
        'BabaDeluxe: Could not reach the chat sidebar. Open the BabaDeluxe panel first.'
      )
      return
    }

    logger.log('[command] git.generatePrMessage request sent, status:', postResult.value)
    await openChat()
  }
}

/**
 * Tries to find a sensible base branch by checking remote tracking branches
 * in order of preference: origin/main, origin/master, origin/develop.
 */
async function resolveBaseBranch(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  repo: any,
  logger: { warn: (msg: string) => void }
): Promise<string | undefined> {
  const candidates = ['origin/main', 'origin/master', 'origin/develop']
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const refs: Array<{ name: string }> = repo.state?.refs ?? []
    const refNames = new Set(refs.map((r) => r.name))
    return candidates.find((c) => refNames.has(c))
  } catch (error) {
    logger.warn('[command] resolveBaseBranch failed: ' + String(error))
    return undefined
  }
}
