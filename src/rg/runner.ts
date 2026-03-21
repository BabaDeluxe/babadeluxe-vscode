import { spawn } from 'node:child_process'
import { Buffer } from 'node:buffer'
import { ok, err, type Result } from 'neverthrow'
import type { RgRunOutput } from './types.js'

export async function runRg(
  rgPath: string,
  cwd: string,
  args: string[]
): Promise<Result<RgRunOutput, Error>> {
  return new Promise((resolve) => {
    const process = spawn(rgPath, args, { cwd })

    const stdoutBuffers: Buffer[] = []
    const stderrBuffers: Buffer[] = []

    process.stdout.on('data', (chunk: Buffer) => {
      stdoutBuffers.push(chunk)
    })

    process.stderr.on('data', (chunk: Buffer) => {
      stderrBuffers.push(chunk)
    })

    process.on('close', (code) => {
      const stdout = Buffer.concat(stdoutBuffers).toString('utf8')
      const stderr = Buffer.concat(stderrBuffers).toString('utf8')

      resolve(ok({
        stdout,
        stderr,
        exitCode: code,
      }))
    })

    process.on('error', (error) => {
      resolve(err(error instanceof Error ? error : new Error(String(error))))
    })
  })
}
