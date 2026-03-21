import { Buffer } from 'node:buffer'
import * as path from 'node:path'
import * as vscode from 'vscode'
import ignore, { type Ignore } from 'ignore'
import { ResultAsync, ok, type Result } from 'neverthrow'

export async function loadRootGitignore(
  rootFsPath: string
): Promise<Result<Ignore | undefined, Error>> {
  const gitignoreUri = vscode.Uri.file(path.join(rootFsPath, '.gitignore'))

  const bytesResult = await ResultAsync.fromPromise(
    vscode.workspace.fs.readFile(gitignoreUri),
    (error: unknown) => (error instanceof Error ? error : new Error(String(error)))
  )

  if (bytesResult.isErr()) return ok(undefined)

  const content = Buffer.from(bytesResult.value).toString('utf8')
  const gitignoreMatcher = ignore().add(content)

  return ok(gitignoreMatcher)
}

function toRelativeSlashPath(rootFsPath: string, candidatePath: string): string {
  const relativePath = path.isAbsolute(candidatePath)
    ? path.relative(rootFsPath, candidatePath)
    : candidatePath

  return relativePath.replaceAll('\\', '/')
}

export function isIgnoredByRootGitignore(
  rootFsPath: string,
  gitignoreMatcher: Ignore,
  candidatePath: string
): boolean {
  const relativeSlashPath = toRelativeSlashPath(rootFsPath, candidatePath)
  if (!relativeSlashPath || relativeSlashPath.startsWith('..')) return false
  return gitignoreMatcher.ignores(relativeSlashPath)
}
