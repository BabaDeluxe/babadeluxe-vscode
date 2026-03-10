export function normalizeRootKey(value: string | undefined): string | undefined {
  if (!value) return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const normalizedSlashes = trimmed.replaceAll('\\', '/')
  return normalizedSlashes.toLowerCase()
}

/**
 * Canonical root key logic used by both UI and storage.
 *
 * Priority:
 * 1. User-selected root (manual override)
 * 2. First workspace folder (monorepo root / workspace default)
 * 3. Active file's parent folder (single loose file)
 * 4. Global fallback
 */
export function getCanonicalRootKey(
  selectedRootFsPath: string | undefined,
  firstWorkspaceFolderFsPath: string | undefined,
  activeFileFolderFsPath: string | undefined
): string {
  const selected = normalizeRootKey(selectedRootFsPath)
  if (selected) return selected

  const workspaceRoot = normalizeRootKey(firstWorkspaceFolderFsPath)
  if (workspaceRoot) return workspaceRoot

  const fileFolder = normalizeRootKey(activeFileFolderFsPath)
  if (fileFolder) return fileFolder

  return '__workspace_root__'
}
