import { logger } from '../logger.js'

/**
 * Offloads async code that is not critical to the main flow to prevent blocking.
 * This pattern ensures that initialization logic or background tasks do not delay extension activation.
 *
 * @param label - A label for logging and identification.
 * @param work - The async function to execute.
 * @returns void - The work is started and not awaited by the caller.
 */
export function runLazyWorkerAsync(label: string, work: () => Promise<void>): void {
  logger.log(`[lazy-worker] Offloading work: ${label}`)

  // Fire and forget, but with error handling
  void work().catch((error: unknown) => {
    logger.warn(`[lazy-worker] Lazy work failed for: ${label}`, error)
  })
}
