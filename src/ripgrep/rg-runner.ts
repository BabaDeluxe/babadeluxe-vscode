import { spawn } from 'node:child_process'
import { type Result, ok, err } from 'neverthrow'
import { RgSearchError } from './errors.js'
import type { RgRunOutput } from './types.js'

export async function runRg(
  rgPath: string,
  cwd: string,
  args: readonly string[]
): Promise<Result<RgRunOutput, RgSearchError>> {
  return new Promise((resolve) => {
    const rg = spawn(rgPath, args, { cwd })

    let stdout = ''
    let stderr = ''
    let isResolved = false

    const resolveOnce = (result: Result<RgRunOutput, RgSearchError>): void => {
      if (isResolved) return

      isResolved = true
      resolve(result)
    }

    rg.stdout.on('data', (chunk: Uint8Array) => {
      stdout += chunk.toString()
    })

    rg.stderr.on('data', (chunk: Uint8Array) => {
      stderr += chunk.toString()
    })

    rg.on('close', (exitCode) => {
      resolveOnce(ok({ stdout, stderr, exitCode }))
    })

    rg.on('error', (error) => {
      resolveOnce(err(new RgSearchError('Failed to spawn ripgrep', error)))
    })
  })
}
