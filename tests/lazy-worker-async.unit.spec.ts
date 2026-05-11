import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { runLazyWorkerAsync } from '../src/utils/lazy-worker-async.js'

vi.mock('../src/logger.js', () => ({
  logger: {
    log: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}))

describe('runLazyWorkerAsync', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.restoreAllMocks())

  it('executes the work function', async () => {
    const work = vi.fn().mockResolvedValue(undefined)
    runLazyWorkerAsync('test-label', work)
    // Let the microtask queue drain
    await vi.waitFor(() => expect(work).toHaveBeenCalledOnce())
  })

  it('does not throw when work rejects — swallows and warns', async () => {
    const { logger } = await import('../src/logger.js')
    const error = new Error('boom')
    const work = vi.fn().mockRejectedValue(error)

    expect(() => runLazyWorkerAsync('failing-label', work)).not.toThrow()

    await vi.waitFor(() =>
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('failing-label'),
        error
      )
    )
  })

  it('returns void — caller cannot await it', () => {
    const work = vi.fn().mockResolvedValue(undefined)
    const result = runLazyWorkerAsync('void-test', work)
    expect(result).toBeUndefined()
  })

  it('logs the label on start', async () => {
    const { logger } = await import('../src/logger.js')
    const work = vi.fn().mockResolvedValue(undefined)
    runLazyWorkerAsync('my-task', work)
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('my-task'))
  })
})
