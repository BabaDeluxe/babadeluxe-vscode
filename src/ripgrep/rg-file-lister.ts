import { err, ok, type Result } from 'neverthrow'
import { ignoreGlobs } from '../infra/constants.js'
import { indexableFileIncludeGlobs } from './indexable-file-extensions.js'
import { loadRootGitignore, isIgnoredByRootGitignore } from './root-gitignore.js'
import { RgSearchError } from './errors.js'
import { runRg } from './rg-runner.js'
import { getRgPath } from './rg-wrapper.js'

export async function listIndexableFiles(cwd: string): Promise<Result<string[], RgSearchError>> {
  const rgPathResult = await getRgPath()
  if (rgPathResult.isErr()) return err(rgPathResult.error)

  const includeGlobArgs = indexableFileIncludeGlobs.flatMap((glob) => ['--glob', glob])
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  const ignoreGlobArgs = ignoreGlobs.flatMap((glob: any) => ['--glob', glob])

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const args = ['--files', ...includeGlobArgs, ...ignoreGlobArgs, '--', cwd]

  const runResult = await runRg(rgPathResult.value, cwd, args)
  if (runResult.isErr()) return err(runResult.error)

  const { exitCode, stderr, stdout } = runResult.value
  if (exitCode !== 0) return err(new RgSearchError(`ripgrep --files failed: ${stderr}`))

  const files = stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const gitignoreResult = await loadRootGitignore(cwd)
  if (gitignoreResult.isErr()) return err(new RgSearchError(gitignoreResult.error.message))

  const gitignoreMatcher = gitignoreResult.value
  if (!gitignoreMatcher) return ok(files)

  const filtered = files.filter(
    (filePath) => !isIgnoredByRootGitignore(cwd, gitignoreMatcher, filePath)
  )

  return ok(filtered)
}
