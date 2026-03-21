import * as fs from 'node:fs/promises'
import { err, ok, type Result } from 'neverthrow'
import rg from '@vscode/ripgrep'

export async function getRgPath(): Promise<Result<string, Error>> {
  const rgPath = rg.rgPath
  if (!rgPath) return err(new Error('Ripgrep path not found.'))

  try {
    const stats = await fs.stat(rgPath)
    if (!stats.isFile()) return err(new Error(`Ripgrep path exists but is not a file: ${rgPath}`))

    return ok(rgPath)
  } catch (error: unknown) {
    return err(
      new Error(
        `Failed to verify ripgrep path "${rgPath}": ${error instanceof Error ? error.message : String(error)}`
      )
    )
  }
}
