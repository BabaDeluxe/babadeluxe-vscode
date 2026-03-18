import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { Result, err, ok, type Result as ResultType } from 'neverthrow'
import { RgSearchError } from './errors.js'

const require = createRequire(import.meta.url)

let cachedRgPath: string | undefined

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function extractRgPathFromModule(moduleValue: unknown): ResultType<string, RgSearchError> {
  if (typeof moduleValue === 'object' && moduleValue !== null) {
    const maybeRgPath = (moduleValue as Record<string, unknown>)['rgPath']
    if (isNonEmptyString(maybeRgPath)) return ok(maybeRgPath)
  }

  return err(new RgSearchError('Unexpected @vscode/ripgrep export. Expected { rgPath: string }.'))
}

function resolveVscodeRipgrepPath(): ResultType<string, RgSearchError> {
  return Result.fromThrowable(
    () => require('@vscode/ripgrep') as unknown,
    (error) =>
      new RgSearchError(
        `Failed to resolve @vscode/ripgrep: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      )
  )()
    .andThen(extractRgPathFromModule)
    .andThen((resolvedPath) => {
      if (!existsSync(resolvedPath)) {
        return err(new RgSearchError(`ripgrep binary not found at: ${resolvedPath}`))
      }

      return ok(resolvedPath)
    })
}

export async function getRgPath(): Promise<ResultType<string, RgSearchError>> {
  if (cachedRgPath) return ok(cachedRgPath)

  const resolvedResult = resolveVscodeRipgrepPath()
  if (resolvedResult.isErr()) return err(resolvedResult.error)

  cachedRgPath = resolvedResult.value
  return ok(cachedRgPath)
}
