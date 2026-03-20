import { Buffer } from 'node:buffer'
import * as path from 'node:path'
import * as vscode from 'vscode'
import { shallowRef, watchEffect, type Ref } from 'reactive-vscode'
import type { GrowthBook } from '@growthbook/growthbook'
import { RgContextBuilder } from '../context/rg-context-builder.js'
import { AutoContextHandler } from '../context/auto-context-handler.js'
import { useBm25Runtime } from '../bm25/use-bm25-runtime.js'
import { logger } from '../infra/logger.js'
import type { UiContextItem, WebviewCommonApi, WebviewMessage } from './types.js'

export function useWebviewCommon(
  context: vscode.ExtensionContext,
  effectiveRootFsPath: Readonly<Ref<string | undefined>>,
  gb: GrowthBook
): WebviewCommonApi {
  const activeHandler = shallowRef<AutoContextHandler | undefined>(undefined)

  watchEffect((onCleanup) => {
    const root = effectiveRootFsPath.value
    if (!root) {
      activeHandler.value = undefined
      logger.log('[context] effective root is not available yet, skipping runtime init')
      return
    }

    const bm25Service = useBm25Runtime(context, root)
    const rgBuilder = new RgContextBuilder(root, 20)
    const handler = new AutoContextHandler(root, rgBuilder, bm25Service, gb)

    activeHandler.value = handler
    logger.log(`[context] auto-context handler rebuilt for: ${root}`)

    onCleanup(() => {
      if (activeHandler.value === handler) {
        activeHandler.value = undefined
      }
    })
  })

  const postContextRoot = (webview: vscode.Webview): void => {
    const root = effectiveRootFsPath.value ?? null
    void webview.postMessage({ type: 'contextRoot.current', root })
  }

  const handleWebviewMessage = async (
    message: WebviewMessage,
    webview: vscode.Webview
  ): Promise<boolean> => {
    if (message.type === 'contextRoot.getCurrent') {
      postContextRoot(webview)
      return true
    }

    if (message.type === 'contextRoot.pick') {
      await vscode.commands.executeCommand('babadeluxe-ai-coder.setContextRoot')
      postContextRoot(webview)
      return true
    }

    if (message.type === 'contextRoot.clear') {
      await vscode.commands.executeCommand('babadeluxe-ai-coder.clearContextRoot')
      postContextRoot(webview)
      return true
    }

    if (message.type === 'contextRoot.openSettings') {
      await vscode.commands.executeCommand('babadeluxe-ai-coder.openSettings')
      return true
    }

    if (message.type === 'autoContext:request') {
      await handleAutoContextRequest(message.requestId, message.query, webview)
      return true
    }

    if (message.type === 'fileContext:resolve') {
      await handleFileContextResolve(message.requestId, message.filePaths, webview)
      return true
    }

    return false
  }

  async function handleAutoContextRequest(
    requestId: string,
    query: string,
    webview: vscode.Webview
  ): Promise<void> {
    const handler = activeHandler.value
    if (!handler) {
      void webview.postMessage({
        type: 'autoContext:response',
        requestId,
        error: 'Context runtime not ready',
        items: [],
      })
      return
    }

    const result = await handler.handleRequest(query)

    if (result.isErr()) {
      void webview.postMessage({
        type: 'autoContext:response',
        requestId,
        error: result.error.message,
        items: [],
      })
      return
    }

    void webview.postMessage({
      type: 'autoContext:response',
      requestId,
      items: result.value,
    })
  }

  async function handleFileContextResolve(
    requestId: string,
    filePaths: string[],
    webview: vscode.Webview
  ): Promise<void> {
    const root = effectiveRootFsPath.value
    if (!root) {
      logger.warn('[context] effective root not ready, cannot resolve file context')
      void webview.postMessage({ type: 'fileContext:response', requestId, items: [] })
      return
    }

    const uniqueFilePaths = [
      ...new Set(filePaths.map((filePath) => filePath.trim()).filter(Boolean)),
    ]

    if (uniqueFilePaths.length === 0) {
      void webview.postMessage({ type: 'fileContext:response', requestId, items: [] })
      return
    }

    const tasks = uniqueFilePaths.map(async (filePath): Promise<UiContextItem> => {
      const fsPath = path.isAbsolute(filePath) ? filePath : path.join(root, filePath)
      const uri = vscode.Uri.file(fsPath)

      const bytes = await vscode.workspace.fs.readFile(uri)
      const content = Buffer.from(bytes).toString('utf8')
      const snippet = content.slice(0, 4000)

      return { id: `${requestId}:${filePath}`, kind: 'manual', filePath, snippet }
    })

    const results = await Promise.allSettled(tasks)
    const resolved: UiContextItem[] = []

    for (const [index, result] of results.entries()) {
      if (result.status === 'fulfilled') {
        resolved.push(result.value)
        continue
      }

      const error = result.reason as unknown
      logger.warn(`Failed to read file "${uniqueFilePaths[index]}": ${String(error)}`)
    }

    void webview.postMessage({ type: 'fileContext:response', requestId, items: resolved })
  }

  return {
    postContextRoot,
    handleWebviewMessage,
  }
}
