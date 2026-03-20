import { describe, expect, it, vi } from 'vitest'
import * as fs from 'node:fs/promises'
import { getRgPath } from '../../src/ripgrep/rg-wrapper.js'

vi.mock('node:fs/promises', () => ({
  stat: vi.fn(),
}))

vi.mock('@vscode/ripgrep', () => ({
  default: { rgPath: '/mock/rg' },
}))

describe('getRgPath', () => {
  it('returns path if it exists and is a file', async () => {
    vi.mocked(fs.stat).mockResolvedValue({ isFile: () => true } as any)
    const result = await getRgPath()
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value).toBe('/mock/rg')
    }
  })

  it('returns error if path is not a file', async () => {
    vi.mocked(fs.stat).mockResolvedValue({ isFile: () => false } as any)
    const result = await getRgPath()
    expect(result.isErr()).toBe(true)
  })

  it('returns error if stat fails', async () => {
    vi.mocked(fs.stat).mockRejectedValue(new Error('stat failed'))
    const result = await getRgPath()
    expect(result.isErr()).toBe(true)
  })
})
