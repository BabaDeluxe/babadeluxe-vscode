import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Base mocks for success case
vi.mock('node:module', () => ({
  createRequire: () => () => ({ rgPath: '/mock/rg.exe' }),
}))

vi.mock('node:fs', () => ({
  existsSync: () => true,
}))

describe('getRgPath', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns Ok when ripgrep path resolves and exists', async () => {
    const { getRgPath: freshGetRgPath } = await import('../src/rg-wrapper.js')
    const result = await freshGetRgPath()

    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toBe('/mock/rg.exe')
  })

  it('returns Err when require throws', async () => {
    vi.doMock('node:module', () => ({
      createRequire: () => () => {
        throw new Error('boom')
      },
    }))

    const { getRgPath: failingGetRgPath } = await import('../src/rg-wrapper.js')
    const result = await failingGetRgPath()

    expect(result.isErr()).toBe(true)
    const error = result._unsafeUnwrapErr()
    expect(error).toBeInstanceOf(Error)
  })

  it('returns Err when export shape is invalid', async () => {
    vi.doMock('node:module', () => ({
      createRequire: () => () => ({}), // No rgPath
    }))

    const { getRgPath: badShapeGetRgPath } = await import('../src/rg-wrapper.js')
    const result = await badShapeGetRgPath()

    expect(result.isErr()).toBe(true)
    const error = result._unsafeUnwrapErr()
    expect(error).toBeInstanceOf(Error)
  })

  it('returns Err when resolved path does not exist', async () => {
    vi.doMock('node:module', () => ({
      createRequire: () => () => ({ rgPath: '/missing/rg.exe' }),
    }))

    vi.doMock('node:fs', () => ({
      existsSync: () => false,
    }))

    const { getRgPath: missingGetRgPath } = await import('../src/rg-wrapper.js')
    const result = await missingGetRgPath()

    expect(result.isErr()).toBe(true)
    const error = result._unsafeUnwrapErr()
    expect(error).toBeInstanceOf(Error)
  })
})
