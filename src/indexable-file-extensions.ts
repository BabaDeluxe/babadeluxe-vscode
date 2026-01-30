import * as path from 'node:path'
import { indexableFileExtensions } from './constants.js'

const indexableFileExtensionSet = new Set<string>(indexableFileExtensions)

export const indexableFileIncludeGlobs: readonly string[] = indexableFileExtensions.map(
  (extension) => `**/*${extension}`
)

export const indexableFileWatcherGlob = `**/*.{${indexableFileExtensions
  .map((extension) => extension.slice(1))
  .join(',')}}`

export function isIndexableFileExtension(filePath: string): boolean {
  const lowerPath = filePath.toLowerCase()
  if (lowerPath.endsWith('.d.ts')) return false

  const extension = path.extname(lowerPath)
  return indexableFileExtensionSet.has(extension)
}
