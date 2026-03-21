import { ref, type Ref } from 'reactive-vscode'
import { GitRecencyService } from './service.js'

type GitRecencyState = {
  timestampMs?: number
  recencyScore: number
}

export function computeGitRecencyScore(lastCommitMs: number): number {
  const now = Date.now()
  const days = (now - lastCommitMs) / (1000 * 60 * 60 * 24)

  if (days <= 1) return 1
  if (days <= 7) return 0.7
  if (days <= 30) return 0.3
  return 0
}

export function useGitRecencyMap(workspaceRootFsPath: string): {
  gitRecencyByPath: Ref<Map<string, GitRecencyState>>
  ensureRecencyFor: (filePath: string) => Promise<void>
} {
  const service = new GitRecencyService(workspaceRootFsPath)
  const gitRecencyByPath = ref(new Map<string, GitRecencyState>())

  const ensureRecencyFor = async (filePath: string): Promise<void> => {
    if (!service.isAvailable()) return

    const existing = gitRecencyByPath.value.get(filePath)
    if (existing?.timestampMs) return

    const ts = await service.ensureTimestamp(filePath)
    if (!ts) return

    const recencyScore = computeGitRecencyScore(ts)

    const next = new Map(gitRecencyByPath.value)
    next.set(filePath, { timestampMs: ts, recencyScore })
    gitRecencyByPath.value = next
  }

  return { gitRecencyByPath, ensureRecencyFor }
}
