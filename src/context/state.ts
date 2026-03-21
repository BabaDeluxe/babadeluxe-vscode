import path from 'node:path'
import type * as vscode from 'vscode'
import { computed, ref, useActiveTextEditor, useWorkspaceFolders } from 'reactive-vscode'
import {
  clearSelectedContextRootFsPath,
  getSelectedContextRootFsPath,
  setSelectedContextRootFsPath,
} from './storage.js'
import { getCanonicalRootKey } from './key.js'

type CreateContextRootStateOptions = {
  context: vscode.ExtensionContext
}

export function createContextRootState(options: CreateContextRootStateOptions) {
  const activeTextEditor = useActiveTextEditor()
  const workspaceFolders = useWorkspaceFolders()

  const selectedContextRootFsPath = ref<string | undefined>(
    getSelectedContextRootFsPath(options.context)
  )

  const isWorkspaceOpen = computed(() => Boolean(workspaceFolders.value?.length))

  const activeEditorUri = computed(() => activeTextEditor.value?.document.uri)

  const firstWorkspaceFolderFsPath = computed(() => workspaceFolders.value?.[0]?.uri.fsPath)

  const activeFileFolderFsPath = computed(() => {
    const uri = activeEditorUri.value
    if (uri?.scheme !== 'file') return undefined
    return path.dirname(uri.fsPath)
  })

  // Canonical root key used by storage - normalized, stable
  const canonicalRootKey = computed(() =>
    getCanonicalRootKey(
      selectedContextRootFsPath.value,
      firstWorkspaceFolderFsPath.value,
      activeFileFolderFsPath.value
    )
  )

  // Human-readable root path for UI display
  const effectiveRootFsPath = computed(() => {
    if (selectedContextRootFsPath.value) return selectedContextRootFsPath.value

    if (firstWorkspaceFolderFsPath.value) return firstWorkspaceFolderFsPath.value

    if (activeFileFolderFsPath.value) return activeFileFolderFsPath.value

    // Fallback: return the canonical key (which includes __workspace_root__)
    return canonicalRootKey.value
  })

  async function setSelectedRootFsPath(fsPath: string): Promise<void> {
    selectedContextRootFsPath.value = fsPath
    await setSelectedContextRootFsPath(options.context, fsPath)
  }

  async function clearSelectedRootFsPath(): Promise<void> {
    selectedContextRootFsPath.value = undefined
    await clearSelectedContextRootFsPath(options.context)
  }

  return {
    isWorkspaceOpen,
    selectedContextRootFsPath,
    effectiveRootFsPath,
    canonicalRootKey,
    setSelectedRootFsPath,
    clearSelectedRootFsPath,
  }
}
