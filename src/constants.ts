export const section = 'babadeluxe-ai-coder'
export const key = 'contextRoot'

export const ignoredDirectories = [
  'node_modules',
  'dist',
  'build',
  'out',
  'coverage',
  '.git',
  '.vscode',
] as const

export const ignoredFilePatterns = [
  '*.d.ts',
  '*.min.*',
  '*-lock.*',
  'pnpm-lock.yaml',
  'yarn.lock',
] as const

export const ignoreGlobs = [
  ...ignoredDirectories.map((directoryName) => `!**/${directoryName}/**`),
  ...ignoredFilePatterns.map((fileName) => `!**/${fileName}`),
] as const

export const extraStopwords = new Set([
  'where',
  'did',
  'in',
  'my',
  'files',
  'file',
  'find',
  'show',
  'search',
  'please',
  'bitte',
  'zeige',
  'finde',
  'suche',
])

export const shortTokenAllowlist = new Set(['rg', 'ci', 'id', 'ts', 'js', 'py', 'cs'])

export const maxFolderPinFiles = 500
