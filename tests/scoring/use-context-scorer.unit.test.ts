import { describe, expect, it } from 'vitest'
import { type ScoringContext, useContextScorer } from '../../src/scoring/use-scoring-context.js'

const makeRef = <T>(value: T) => ({ value })

describe('useContextScorer', () => {
  it('adds boosts for active, visible, recent and same dir', () => {
    const ctx: ScoringContext = {
      activeFilePath: '/ws/src/a.ts',
      visibleFilePaths: new Set(['/ws/src/a.ts', '/ws/src/b.ts']),
      recentFilePaths: new Set(['/ws/src/c.ts']),
      gitRecencyByPath: new Map(),
    }

    const scorer = useContextScorer(makeRef(ctx))

    expect(scorer('/ws/src/a.ts')).toBe(80 + 40 + 20) // Active + visible + same-dir
    expect(scorer('/ws/src/b.ts')).toBe(40 + 20) // Visible + same-dir
    expect(scorer('/ws/src/c.ts')).toBe(30) // Recent only
  })

  it('adds git recency boost', () => {
    const ctx: ScoringContext = {
      activeFilePath: undefined,
      visibleFilePaths: new Set(),
      recentFilePaths: new Set(),
      gitRecencyByPath: new Map([['/file.ts', { recencyScore: 0.8, timestampMs: 123 }]]),
    }

    const scorer = useContextScorer(makeRef(ctx))

    expect(scorer('/file.ts')).toBeCloseTo(0.8 * 25)
  })
})
