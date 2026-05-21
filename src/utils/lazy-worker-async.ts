import { BaseError } from '@babadeluxe/shared'
import { type Result, ResultAsync, err } from 'neverthrow'
import { logger } from '../logger.js'

class LazyWorkerError extends BaseError {}

/**
 * Offloads async code that is not critical to the main flow to prevent blocking.
 * This pattern ensures that initialization logic or background tasks do not delay extension activation.
 *
 * @param label - A label for logging and identification.
 * @param work - The async function to execute.
 * @returns void - The work is started and not awaited by the caller.
 */
export async function runLazyWorkerAsync(
  label: string,
  work: () => Promise<void>
): Promise<Result<void, LazyWorkerError>> {
  logger.log(`[lazy-worker] Offloading work: ${label}`)

  const result = await ResultAsync.fromPromise(work(), (error: unknown) =>
    error instanceof Error ? new LazyWorkerError(error.message) : new LazyWorkerError(String(error))
  )

  if (result.isErr()) {
    logger.warn(`[lazy-worker] Lazy work failed for: ${label}`, result.error)
    return err(result.error)
  }

  return result
}
