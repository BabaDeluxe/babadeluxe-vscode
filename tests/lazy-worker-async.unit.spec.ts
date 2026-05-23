import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { runLazyWorkerAsync } from '../src/utils/lazy-worker-async.js'
import type { Result } from 'neverthrow'

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
    await vi.waitFor(() => {
      expect(work).toHaveBeenCalledOnce()
    })
  })

  it('does not throw when work rejects — swallows and warns', async () => {
    const { logger } = await import('../src/logger.js')
    const error = new Error('boom')
    const work = vi.fn().mockRejectedValue(error)

    expect(() => {
      runLazyWorkerAsync('failing-label', work)
    }).not.toThrow()

    await vi.waitFor(() => {
      expect(logger.warn).toHaveBeenCalledTimes(1)
      const [message, loggedError] = (logger.warn as ReturnType<typeof vi.fn>).mock.calls[0] as [
        string,
        Error,
      ]
      expect(message).toContain('failing-label')
      // The impl wraps the original error in LazyWorkerError — check message propagation
      expect(loggedError).toBeInstanceOf(Error)
      expect(loggedError.message).toContain('boom')
    })
  })

  it('returns a Promise<Result> — caller may choose to await it', async () => {
    const work = vi.fn().mockResolvedValue(undefined)
    const resultPromise = runLazyWorkerAsync('void-test', work)
    // The function is async and returns a Promise — not void
    expect(resultPromise).toBeInstanceOf(Promise)
    const result = (await resultPromise) as Result<void, Error>
    expect(result.isOk()).toBe(true)
  })

  it('logs the label on start', async () => {
    const { logger } = await import('../src/logger.js')
    const work = vi.fn().mockResolvedValue(undefined)
    runLazyWorkerAsync('my-task', work)
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('my-task'))
  })
})
