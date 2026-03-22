import { ref, useDisposable, onScopeDispose, computed } from 'reactive-vscode'
import { workspace, type TextDocument } from 'vscode'

/**
 * Tracks recently saved files within a specified time window.
 * Returns a reactive Set of file paths.
 */
export function useRecentFiles(retentionMs = 10 * 60 * 1000) {
  const recentFiles = ref(new Map<string, number>())
  useDisposable(
    workspace.onDidSaveTextDocument((doc: TextDocument) => {
      const newMap = new Map(recentFiles.value)
      newMap.set(doc.uri.fsPath, Date.now())
      recentFiles.value = newMap
    })
  )
  const intervalId = setInterval(() => {
    const now = Date.now()
    let changed = false
    const currentMap = recentFiles.value

    for (const [file, time] of currentMap.entries()) {
      if (now - time > retentionMs) {
        currentMap.delete(file)
        changed = true
      }
    }

    if (changed) {
      recentFiles.value = new Map(currentMap)
    }
  }, 60000)

  onScopeDispose(() => {
    clearInterval(intervalId)
  })

  return computed(() => new Set(recentFiles.value.keys()))
}
