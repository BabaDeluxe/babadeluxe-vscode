import { describe, it, expect } from 'vitest'
import { pickAdaptiveScoredCandidates } from '../src/adaptive-candidates.js'
import type { ScoredCandidate } from '../src/types.js'

describe('pickAdaptiveScoredCandidates', () => {
  const createCandidate = (score: number, filePath = `file${score}.ts`): ScoredCandidate => ({
    filePath,
    score,
  })

  it('returns empty array when input is empty', () => {
    const result = pickAdaptiveScoredCandidates([])
    expect(result).toEqual([])
  })

  it('returns all candidates when count is under minimum (30)', () => {
    const candidates = Array.from({ length: 20 }, (_, i) => createCandidate(100 - i))
    const result = pickAdaptiveScoredCandidates(candidates)
    expect(result).toHaveLength(20)
  })

  it('enforces maximum of 120 candidates', () => {
    const candidates = Array.from({ length: 150 }, (_, i) => createCandidate(100 - i * 0.1))
    const result = pickAdaptiveScoredCandidates(candidates)
    expect(result).toHaveLength(120)
  })

  it('applies relative cutoff (25% of top score) after minimum candidates', () => {
    const topScore = 100
    const cutoff = topScore * 0.25

    const candidates = [
      ...Array.from({ length: 30 }, () => createCandidate(topScore)),
      createCandidate(26),
      createCandidate(25),
      createCandidate(24),
      createCandidate(10),
    ]

    const result = pickAdaptiveScoredCandidates(candidates)

    expect(result.length).toBeGreaterThanOrEqual(30)
    expect(result.length).toBeLessThan(34)
    expect(result.every((c) => c.score >= cutoff)).toBe(true)
  })

  it('uses absolute floor (0.001) when relative cutoff would be lower', () => {
    const topScore = 0.002
    const absoluteFloor = 0.001

    const candidates = [
      ...Array.from({ length: 30 }, () => createCandidate(topScore)),
      createCandidate(0.0015),
      createCandidate(0.001),
      createCandidate(0.0009),
    ]

    const result = pickAdaptiveScoredCandidates(candidates)

    expect(result.every((c) => c.score >= absoluteFloor)).toBe(true)
  })

  it('includes minimum 30 candidates even if some are below cutoff', () => {
    const candidates = [
      ...Array.from({ length: 10 }, () => createCandidate(100)),
      ...Array.from({ length: 25 }, () => createCandidate(10)),
    ]

    const result = pickAdaptiveScoredCandidates(candidates)

    expect(result).toHaveLength(30)
  })

  it('stops at cutoff after minimum when candidates drop sharply', () => {
    const candidates = [
      ...Array.from({ length: 35 }, () => createCandidate(100)),
      ...Array.from({ length: 20 }, () => createCandidate(5)),
    ]

    const result = pickAdaptiveScoredCandidates(candidates)

    expect(result).toHaveLength(35)
  })
})
