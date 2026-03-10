import * as vscode from 'vscode'
import { defineExtension, useCommands, useDisposable } from 'reactive-vscode'
import { logger } from './logger.js'
import { SupabaseOAuthController } from './supabase-oauth-controller.js'
import { useBabaSidebarView } from './baba-sidebar-view.js'
import { registerDevelopmentAutoReload } from './development-auto-reload.js'
import { disposeAllBm25Runtimes } from './use-bm25-runtime.js'
import { commandRegistry } from './commands/generated-registry.js'
import { registerLazyCommands } from './commands/register-lazy-commands.js'

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
