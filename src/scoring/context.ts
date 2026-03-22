import * as path from 'node:path'

export type ScoringContext = {
  activeFilePath: string | undefined
  visibleFilePaths: Set<string>
  recentFilePaths: Set<string>
  gitRecencyByPath: Map<string, { timestampMs?: number; recencyScore: number }>
}

export type ReadonlyRef<T> = { readonly value: T }

export function useContextScorer(context: ReadonlyRef<ScoringContext>) {
  return (filePath: string): number => {
    const ctx = context.value
    let boost = 0

    if (ctx.activeFilePath === filePath) boost += 80
    if (ctx.visibleFilePaths.has(filePath)) boost += 40
    if (ctx.recentFilePaths.has(filePath)) boost += 30

    if (ctx.activeFilePath && path.dirname(ctx.activeFilePath) === path.dirname(filePath)) {
      boost += 20
    }

    const gitRecency = ctx.gitRecencyByPath.get(filePath)?.recencyScore ?? 0
    // Max +25 from git recency; feel free to tweak
    boost += gitRecency * 25

    return boost
  }
}
