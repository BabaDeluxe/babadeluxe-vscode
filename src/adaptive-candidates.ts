import type { ScoredCandidate } from './types.js'

export function pickAdaptiveCandidates(scored: readonly ScoredCandidate[]): string[] {
  const minCandidates = 30
  const maxCandidates = 120
  const relativeCutoff = 0.25
  const absoluteFloor = 0.001

  if (scored.length === 0) return []

  const topScore = scored[0]!.score
  const cutoff = Math.max(absoluteFloor, topScore * relativeCutoff)

  const picked: string[] = []
  for (const item of scored) {
    if (picked.length >= maxCandidates || (picked.length >= minCandidates && item.score < cutoff))
      break
    picked.push(item.filePath)
  }

  return picked
}

export function pickAdaptiveScoredCandidates(
  scored: readonly ScoredCandidate[]
): ScoredCandidate[] {
  const minCandidates = 30
  const maxCandidates = 120
  const relativeCutoff = 0.25
  const absoluteFloor = 0.001

  if (scored.length === 0) return []

  const topScore = scored[0]!.score
  const cutoff = Math.max(absoluteFloor, topScore * relativeCutoff)

  const picked: ScoredCandidate[] = []
  for (const item of scored) {
    if (picked.length >= maxCandidates || (picked.length >= minCandidates && item.score < cutoff))
      break
    picked.push(item)
  }

  return picked
}
