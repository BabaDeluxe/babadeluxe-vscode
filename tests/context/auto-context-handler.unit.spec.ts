import { describe, expect, it, vi, beforeEach } from 'vitest'
import { ok } from 'neverthrow'
import type { GrowthBook } from '@growthbook/growthbook'
import { AutoContextHandler } from '../../src/context/auto-context-handler.js'
import { RgContextBuilder } from '../../src/context/rg-context-builder.js'

vi.mock('reactive-vscode', () => ({
  useActiveTextEditor: vi.fn().mockReturnValue({ value: undefined }),
  useVisibleTextEditors: vi.fn().mockReturnValue({ value: [] }),
  computed: vi.fn((fn: () => unknown) => ({ value: fn() })),
}))

vi.mock('../../src/git/use-git-recency-map.js', () => ({
  useGitRecencyMap: vi.fn().mockReturnValue({
    gitRecencyByPath: { value: new Map() },
    ensureRecencyFor: vi.fn().mockResolvedValue(undefined),
  }),
}))

vi.mock('../../src/scoring/use-recent-files.js', () => ({
  useRecentFiles: vi.fn().mockReturnValue({ value: [] }),
}))

vi.mock('../../src/scoring/use-scoring-context.js', () => ({
  useContextScorer: vi.fn().mockReturnValue(() => 0),
}))

describe('AutoContextHandler', () => {
  let handler: AutoContextHandler
  let mockRgBuilder: RgContextBuilder
  let mockGb: GrowthBook

  beforeEach(() => {
    mockRgBuilder = {
      buildContext: vi.fn().mockResolvedValue(ok([])),
    } as unknown as RgContextBuilder
    mockGb = {
      track: vi.fn(),
    } as unknown as GrowthBook
    handler = new AutoContextHandler('/root', mockRgBuilder, undefined, mockGb)
  })

  it('handles request correctly', async () => {
    const result = await handler.handleRequest('query')
    expect(result.isOk()).toBe(true)
    expect(mockGb.track).toHaveBeenCalledWith('auto-context-request', expect.any(Object))
  })

  it('returns error for empty query', async () => {
    const result = await handler.handleRequest('')
    expect(result.isErr()).toBe(true)
  })
})
