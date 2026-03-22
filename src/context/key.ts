export function getCanonicalRootKey(
  selectedContextRootFsPath: string | undefined,
  firstWorkspaceFolderFsPath: string | undefined,
  activeFileFolderFsPath: string | undefined
): string {
  if (selectedContextRootFsPath) return `root:${selectedContextRootFsPath}`
  if (firstWorkspaceFolderFsPath) return `workspace:${firstWorkspaceFolderFsPath}`
  if (activeFileFolderFsPath) return `file:${activeFileFolderFsPath}`
  return 'default'
}
