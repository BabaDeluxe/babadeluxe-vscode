import * as vscode from 'vscode'
import { logger } from '../system/log.js'

export function registerDevelopmentAutoReload(context: vscode.ExtensionContext): void {
  const isDevelopmentMode = context.extensionMode === vscode.ExtensionMode.Development
  if (!isDevelopmentMode) return

  let debounceTimeout: NodeJS.Timeout | undefined
  let isReloading = false

  let sawManifestChange = false

  const scheduleReload = (reason: string, debounceMs: number) => {
    if (isReloading) return
    if (debounceTimeout) clearTimeout(debounceTimeout)

    debounceTimeout = setTimeout(() => {
      isReloading = true
      logger.log(`${reason}, reloading window...`)
      void vscode.commands.executeCommand('workbench.action.reloadWindow')
    }, debounceMs)
  }

  const distPattern = new vscode.RelativePattern(context.extensionUri, 'dist/**/*.js')
  const distWatcher = vscode.workspace.createFileSystemWatcher(distPattern, true, false, true)

  distWatcher.onDidChange(() => {
    const reason = sawManifestChange
      ? 'Extension manifest + code changed'
      : 'Extension code changed'
    scheduleReload(reason, 500)
  })

  distWatcher.onDidCreate(() => {
    const reason = sawManifestChange
      ? 'Extension manifest + code changed'
      : 'Extension code changed'
    scheduleReload(reason, 500)
  })

  const manifestPattern = new vscode.RelativePattern(context.extensionUri, 'package.json')
  const manifestWatcher = vscode.workspace.createFileSystemWatcher(
    manifestPattern,
    true,
    false,
    true
  )

  const onManifestTouched = () => {
    sawManifestChange = true

    // If dist changes shortly after (normal build), dist watcher will schedule the reload sooner.
    // If dist never changes (rare), we still reload after a longer debounce so contributions update. [web:29]
    scheduleReload('Extension manifest changed', 1500)
  }

  manifestWatcher.onDidChange(onManifestTouched)
  manifestWatcher.onDidCreate(onManifestTouched)

  context.subscriptions.push(distWatcher, manifestWatcher)
  logger.log('Development auto-reload enabled (dist/extension.js + package.json)')
}
