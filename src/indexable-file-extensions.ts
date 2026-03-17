import path from 'node:path'

const ignoredFilePatterns = [
  /\.d\.ts$/i,
  /\.min\./i,
  /-lock\./i,
  /pnpm-lock\.yaml$/i,
  /yarn\.lock$/i,
] as const

export const indexableFileIncludeGlobs = ['**/*'] as const

export const indexableFileWatcherGlob = '**/*'

export function isIndexableFileExtension(filePath: string): boolean {
  const lowerPath = filePath.toLowerCase()
  for (const pattern of ignoredFilePatterns) {
    if (pattern.test(lowerPath)) return false
  }

  const extension = path.extname(lowerPath)
  if (!extension) return false

  return true
}
