import * as vscode from 'vscode'
import { defineExtension, useCommands, useDisposable } from 'reactive-vscode'
import { logger } from './logger.js'
import { SupabaseOAuthController } from './supabase-oauth-controller.js'
import { useBabaSidebarView } from './baba-sidebar-view.js'
import { registerDevelopmentAutoReload } from './development-auto-reload.js'
import { disposeAllBm25Runtimes } from './use-bm25-runtime.js'
import { commandRegistry } from './commands/generated-registry.js'
import { registerLazyCommands } from './commands/register-lazy-commands.js'
import { runLazyWorkerAsync } from './utils/lazy-worker-async.js'
import { detectAiApiKeys } from './api-key-detector/detector.js'

const CANCELLED_DETECTION_KEY = 'babadeluxe-ai-coder.api-key-detection-cancelled'

const extension = defineExtension((context: vscode.ExtensionContext) => {
  logger.log('[extension] BabaDeluxe AI Coder activation started')

  logger.log('[extension] 1. Registering development auto-reload')
  registerDevelopmentAutoReload(context)

  logger.log('[extension] 2. Creating SupabaseOAuthController')
  const supabaseOAuthController = new SupabaseOAuthController(context, logger)
  useDisposable(supabaseOAuthController)

  logger.log('[extension] 3. Calling useBabaSidebarView')
  const sidebar = useBabaSidebarView({
    context,
    extensionUri: context.extensionUri,
    supabaseOAuthController,
  })
  logger.log('[extension] 4. useBabaSidebarView returned successfully')

  logger.log('[extension] 5. Registering URI handler')
  useDisposable(
    vscode.window.registerUriHandler({
      async handleUri(uri: vscode.Uri): Promise<void> {
        const toSafeLoggableUri = (value: vscode.Uri): string =>
          `${value.scheme}://${value.authority}${value.path}`

        logger.log('[extension] URI handler received:', toSafeLoggableUri(uri))
        const result = await supabaseOAuthController.handleAuthCallback(uri)
        if (result.isErr()) {
          logger.warn('[extension] Auth callback failed:', result.error.message)
          void vscode.window.showErrorMessage(result.error.message)
        }
      },
    })
  )

  const openChat = async () => {
    logger.log('[extension] Opening chat sidebar')
    return vscode.commands.executeCommand('babadeluxe-ai-coder-chat.focus')
  }

  logger.log('[extension] 6. Registering commands (lazy)')
  useCommands(
    registerLazyCommands({
      dependencies: {
        context,
        vscode,
        logger,
        sidebar,
        openChat,
      },
      entries: commandRegistry,
    })
  )

  logger.log('[extension] 7. Running AI API Key detection (lazy)')
  runLazyWorkerAsync('api-key-detection', async () => {
    if (context.globalState.get<boolean>(CANCELLED_DETECTION_KEY)) {
      logger.log('[extension] API key detection was previously cancelled by user, skipping')
      return
    }

    const result = await detectAiApiKeys()
    if (result.isErr()) {
      logger.warn('[extension] API key detection failed', result.error)
      return
    }

    const detected = result.value
    if (detected.length === 0) {
      logger.log('[extension] No AI API keys detected')
      return
    }

    const providers = detected.map((d) => d.provider).join(', ')
    const selection = await vscode.window.showInformationMessage(
      `BabaDeluxe detected AI API keys for ${providers} in your VS Code settings. Do you want to use them in BabaDeluxe to start quicker?`,
      'OK',
      'Cancel'
    )

    if (selection === 'OK') {
      logger.log('[extension] User accepted API key import')
      await sidebar.postMessageToSidebar({
        type: 'import-ai-keys',
        payload: detected.map((d) => ({ provider: d.provider, key: d.key })),
      })
    } else if (selection === 'Cancel') {
      logger.log('[extension] User cancelled API key import')
      await context.globalState.update(CANCELLED_DETECTION_KEY, true)
    }
  })

  logger.log('[extension] BabaDeluxe AI Coder extension activated successfully')

  return {}
})

export const { activate, deactivate: deactivateExtension } = extension

export function deactivate() {
  logger.log('[extension] Deactivating extension, disposing BM25 runtimes')
  disposeAllBm25Runtimes()

  if (deactivateExtension) {
    void deactivateExtension()
  }

  logger.log('[extension] Extension deactivated')
}
