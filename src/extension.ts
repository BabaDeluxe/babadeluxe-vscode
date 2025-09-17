import * as vscode from 'vscode'
import { ChatPanelManager } from './chat-panel-manager.js'
import { BabaDeluxeWebviewProvider } from './baba-deluxe-webview-provider.js'

export type WebviewConfig = {
  readonly enableScripts: boolean
  readonly retainContextWhenHidden?: boolean
  readonly localResourceRoots: readonly vscode.Uri[]
}

export function activate(context: vscode.ExtensionContext): void {
  const provider = new BabaDeluxeWebviewProvider(context.extensionUri)
  const chatManager = new ChatPanelManager(context.extensionUri)

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('babadeluxe-ai-coder-panel', provider),
    vscode.commands.registerCommand('babadeluxe-ai-coder.openChat', async () =>
      chatManager.createChatPanel()
    )
  )
}
