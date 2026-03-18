import * as vscode from 'vscode'
import { ok, err, type Result } from 'neverthrow'
import { ref, useWebviewView, watchEffect, onScopeDispose } from 'reactive-vscode'
import { loadAndProcessHtml } from './csp-helper.js'
import { logger } from '../infra/logger.js'
import { ContextPinsStore } from '../context/context-pins-store.js'
import { WebviewPinsController, type PostStatus } from './webview-pins-controller.js'
import { useWebviewCommon } from './use-webview-common.js'
import { WebviewAuthController } from '../auth/webview-auth-controller.js'
import type { SupabaseOAuthController } from '../auth/supabase-oauth-controller.js'
import { SidebarWebviewNotReadyError } from './errors.js'
import { createContextRootState } from '../context/context-root-state.js'
import { isRecord, isWebviewMessage } from '../infra/type-guards.js'
import { detectDevelopmentMode } from './csp-helper.js'

export type SidebarApi = Readonly<{
  postMessageToSidebar: (
    message: unknown
  ) => Promise<Result<PostStatus | undefined, SidebarWebviewNotReadyError>>
}>

let cachedSidebarApi: SidebarApi | undefined

export function useBabaSidebarView(parameters: {
  context: vscode.ExtensionContext
  extensionUri: vscode.Uri
  supabaseOAuthController: SupabaseOAuthController
  gb: import('@growthbook/growthbook').GrowthBook
}): SidebarApi {
  logger.log('[sidebar-init] 1. useBabaSidebarView called')

  if (cachedSidebarApi) {
    logger.log('[sidebar-init] 1a. Returning cached sidebar API')
    return cachedSidebarApi
  }

  logger.log('[sidebar-init] 2. Setting up new sidebar instance')

  onScopeDispose(() => {
    logger.log('[sidebar-init] X. Scope disposed, clearing cached API')
    cachedSidebarApi = undefined
  })

  logger.log('[sidebar-init] 3. Initializing contextRootState')
  const contextRootState = createContextRootState({ context: parameters.context })

  logger.log('[sidebar-init] 4. Creating pinsController')
  const pinsController = new WebviewPinsController(
    new ContextPinsStore(parameters.context),
    () => contextRootState.canonicalRootKey.value
  )

  logger.log('[sidebar-init] 5. Creating commonApi via useWebviewCommon')
  const commonApi = useWebviewCommon(parameters.context, contextRootState.effectiveRootFsPath, parameters.gb)

  logger.log('[sidebar-init] 6. Creating html ref and webview API')
  const html = ref('')
  const viewApi = useWebviewView('babadeluxe-ai-coder-chat', html)

  let authController: WebviewAuthController | undefined

  logger.log('[sidebar-init] 7. Setting up primary watchEffect (webview lifecycle)')
  watchEffect((onCleanup) => {
    const webview = viewApi.webview.value

    if (!webview) {
      logger.log('[sidebar-watch] 7a. Webview not ready yet, cleaning up controllers')
      if (authController) {
        authController.dispose()
        authController = undefined
      }

      return
    }

    logger.log('[sidebar-watch] 7b. Webview is ready, configuring options')
    webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(parameters.extensionUri, 'dist/webview')],
    }

    logger.log('[sidebar-watch] 7c. Creating authController')
    authController = new WebviewAuthController(parameters.supabaseOAuthController, (message) =>
      webview.postMessage(message)
    )

    logger.log('[sidebar-watch] 7d. Attaching pinsController to webview')
    pinsController.attach(webview)

    logger.log('[sidebar-watch] 7e. Posting initial context root')
    commonApi.postContextRoot(webview)

    let isCancelled = false
    onCleanup(() => {
      logger.log('[sidebar-watch] 7z. Cleanup callback triggered')
      isCancelled = true
      if (authController) {
        authController.dispose()
        authController = undefined
      }

      pinsController.detach()
    })

    logger.log('[sidebar-watch] 7f. Starting development mode check')
    void (async () => {
      const { isDevelopmentMode, webviewDevServerUrl } = detectDevelopmentMode()

      if (!isDevelopmentMode) {
        logger.log('[sidebar-watch] 7g. Not in dev mode, skipping HTML reload')
        return
      }

      logger.log('[sidebar-watch] 7h. Dev mode detected, loading HTML')

      try {
        const nextHtml = await loadAndProcessHtml({
          extensionUri: parameters.extensionUri,
          webview,
          isDevelopmentMode,
          webviewDevServerUrl,
        })

        if (isCancelled) {
          logger.log('[sidebar-watch] 7i. Cancelled during HTML load, aborting')
          return
        }

        logger.log('[sidebar-watch] 7j. Setting HTML and forcing reload')
        html.value = nextHtml
        viewApi.forceReload()
        logger.log('[sidebar-watch] 7k. Sidebar webview resolved (reactive-vscode)')
      } catch (unknownError) {
        // Framework boundary: we log the unexpected failure here with context.
        // LoadAndProcessHtml itself should already wrap infra errors into domain errors.
        logger.error('[sidebar-watch] Failed to load sidebar HTML in dev mode', {
          error: unknownError,
        })
      }
    })()

    logger.log('[sidebar-watch] 7l. Registering message listener')
    const messageDisposable = webview.onDidReceiveMessage((message: unknown) => {
      if (!isWebviewMessage(message)) {
        logger.log('[sidebar-msg] Received non-webview message, ignoring')
        return
      }

      logger.log(`[sidebar-msg] Received message: ${message.type}`)

      void (async () => {
        if (authController && (await authController.handleWebviewMessage(message))) {
          logger.log('[sidebar-msg] Message handled by authController')
          return
        }

        if (await pinsController.handleWebviewMessage(message)) {
          logger.log('[sidebar-msg] Message handled by pinsController')
          return
        }

        logger.log('[sidebar-msg] Message forwarded to commonApi')
        await commonApi.handleWebviewMessage(message, webview)
      })()
    })

    onCleanup(() => {
      logger.log('[sidebar-watch] Disposing message listener')
      messageDisposable.dispose()
    })
  })

  logger.log('[sidebar-init] 8. Setting up secondary watchEffect (context root sync)')
  watchEffect(() => {
    const webview = viewApi.webview.value
    if (!webview) {
      logger.log('[sidebar-sync] Webview not ready, skipping sync')
      return
    }

    const currentRoot = contextRootState.effectiveRootFsPath.value
    logger.log('[sidebar-sync] Syncing context root and pins snapshot, root:', currentRoot)

    commonApi.postContextRoot(webview)
    void pinsController.refreshSnapshot()
  })

  logger.log('[sidebar-init] 9. Creating and caching sidebar API')
  cachedSidebarApi = {
    async postMessageToSidebar(
      message: unknown
    ): Promise<Result<PostStatus | undefined, SidebarWebviewNotReadyError>> {
      logger.log('[sidebar-api] postMessageToSidebar called with:', message)

      const webview = viewApi.webview.value
      if (!webview) {
        logger.warn('[sidebar-api] Webview not ready, returning error')
        return err(new SidebarWebviewNotReadyError('Sidebar webview is not active.'))
      }

      if (
        isRecord(message) &&
        (message['type'] === 'context:pinFile' || message['type'] === 'context:pinSnippet')
      ) {
        logger.log('[sidebar-api] Handling pin command via pinsController')
        const status = await pinsController.persistPinFromCommand(message)
        logger.log('[sidebar-api] Pin command status:', status)
        return ok(status)
      }

      logger.log('[sidebar-api] Forwarding generic message to webview')
      await webview.postMessage(message)
      return ok(undefined)
    },
  }

  logger.log('[sidebar-init] 10. Sidebar initialization complete, returning API')
  return cachedSidebarApi

  function detectDevelopmentMode() {
    const isDevelopmentMode = parameters.context.extensionMode === vscode.ExtensionMode.Development
    const webviewDevServerUrl = isDevelopmentMode ? 'http://127.0.0.1:5100' : undefined

    if (isDevelopmentMode) {
      logger.log(`[sidebar-dev] Development mode enabled, dev server: ${webviewDevServerUrl}`)
    } else {
      logger.warn('[sidebar-dev] Production mode (no dev server)')
    }

    return { isDevelopmentMode, webviewDevServerUrl }
  }
}
