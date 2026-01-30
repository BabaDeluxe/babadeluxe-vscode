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

export const ignoredFiles = [
  '*.d.ts',
  '*.min.*',
  '*-lock.*',
  'pnpm-lock.yaml',
  'yarn.lock',
] as const

export const ignoreGlobs = [
  ...ignoredDirectories.map((directoryName) => `!**/${directoryName}/**`),
  ...ignoredFiles.map((fileName) => `!**/${fileName}`),
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

export const indexableFileExtensions = [
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.jsonc',
  '.md',
  '.txt',
  '.yml',
  '.yaml',
  '.py',
  '.cs',
  '.html',
  '.css',
  '.scss',
] as const
