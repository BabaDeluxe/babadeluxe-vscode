import { describe, expect, it } from 'vitest'
import { pickAdaptiveScoredCandidates } from '../../src/scoring/candidates.js'

describe('pickAdaptiveScoredCandidates', () => {
  it('picks top candidates', () => {
    const candidates = [
      { filePath: 'a.ts', score: 100 },
      { filePath: 'b.ts', score: 50 },
      { filePath: 'c.ts', score: 10 },
    ]
    const picked = pickAdaptiveScoredCandidates(candidates)
    expect(picked).toHaveLength(3)
    expect(picked[0]?.filePath).toBe('a.ts')
  })

  it('handles empty input', () => {
    const picked = pickAdaptiveScoredCandidates([])
    expect(picked).toEqual([])
  })
})
