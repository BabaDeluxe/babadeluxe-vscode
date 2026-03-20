import * as vscode from 'vscode'
import { Result, ok, err } from 'neverthrow'
import { ignoreGlobs } from '../infra/constants.js'
import { logger } from '../infra/logger.js'
import { getRgPath } from './rg-wrapper.js'
import { runRg } from './rg-runner.js'

export async function listIndexableFiles(
  cwd: string
): Promise<Result<string[], Error>> {
  const rgPathResult = await getRgPath()
  if (rgPathResult.isErr()) return err(rgPathResult.error)

  const ignoreGlobArgs = ignoreGlobs.flatMap((glob) => ['--glob', `!${glob}`])

  const args = [
    '--files',
    '--hidden',
    '--max-filesize', '512K',
    ...ignoreGlobArgs,
  ]

  const runResult = await runRg(rgPathResult.value, cwd, args)
  if (runResult.isErr()) return err(runResult.error)

  const files = runResult.value.stdout
    .trim()
    .split('\n')
    .filter(Boolean)

  return ok(files)
}
