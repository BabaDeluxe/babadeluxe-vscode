import * as vscode from 'vscode'
import { defineExtension, useCommands, useDisposable, watchEffect } from 'reactive-vscode'
import { logger } from './infra/logger.js'
import { SupabaseOAuthController } from './auth/supabase-oauth-controller.js'
import { useBabaSidebarView } from './webview/baba-sidebar-view.js'
import { registerDevelopmentAutoReload } from './ui/development-auto-reload.js'
import { disposeAllBm25Runtimes } from './bm25/use-bm25-runtime.js'
import { commandRegistry } from './commands/generated-registry.js'
import { registerLazyCommands } from './commands/register-lazy-commands.js'
import { initGrowthBook } from './growthbook.js'

const extension = defineExtension(async (context: vscode.ExtensionContext) => {
  logger.log('[extension] BabaDeluxe AI Coder activation started')

  logger.log('[extension] 0. Initializing GrowthBook')
  const gb = initGrowthBook()

  // Start loading features in background
  const initPromise = gb.init()

  logger.log('[extension] 1. Registering development auto-reload')
  registerDevelopmentAutoReload(context)

  logger.log('[extension] 2. Creating SupabaseOAuthController')
  const supabaseOAuthController = new SupabaseOAuthController(context, logger, gb)
  useDisposable(supabaseOAuthController)

  // Track session status in GrowthBook
  watchEffect(async () => {
    const sessionResult = await supabaseOAuthController.getStoredSession()
    const isLoggedIn = sessionResult.isOk() && !!sessionResult.value
    gb.setAttributes({
      ...gb.getAttributes(),
      isLoggedIn,
    })
  })

  logger.log('[extension] 3. Calling useBabaSidebarView')
  const sidebar = useBabaSidebarView({
    context,
    extensionUri: context.extensionUri,
    supabaseOAuthController,
    gb,
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
        gb,
      },
      entries: commandRegistry,
    })
  )

  // Ensure features are loaded before we finish activation if possible,
  // but don't block forever if it's slow.
  try {
    await Promise.race([
      initPromise,
      new Promise<void>((resolve) => {
        setTimeout(resolve, 2000)
      })
    ])
  } catch (error: unknown) {
    logger.warn('[extension] GrowthBook features load failed or timed out', error)
  }

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
