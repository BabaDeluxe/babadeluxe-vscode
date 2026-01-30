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

    rg.stdout.on('data', (chunk: Uint8Array) => {
      stdout += chunk.toString()
    })

    rg.stderr.on('data', (chunk: Uint8Array) => {
      stderr += chunk.toString()
    })

    rg.on('close', (exitCode) => {
      resolve(ok({ stdout, stderr, exitCode }))
    })

    rg.on('error', (error) => {
      resolve(err(new RgSearchError('Failed to spawn ripgrep', error)))
    })
  })
}
