import * as vscode from 'vscode'
import type { BabaSidebarView } from './baba-sidebar-view.js'

/**
 * Watches the active text editor and forwards its state to the webview
 * as an `editor:activeChanged` message on every editor switch and on
 * sidebar visibility gain.
 *
 * Only `file://` URIs are forwarded — untitled buffers, git-diff editors
 * and output-panel pseudo-documents are silently ignored.
 */
export function registerActiveEditorWatcher(
  context: vscode.ExtensionContext,
  sidebar: BabaSidebarView,
): void {
  const send = (editor: vscode.TextEditor | undefined): void => {
    if (!editor) return
    if (editor.document.uri.scheme !== 'file') return

    const visibleRange = editor.visibleRanges[0]

    void sidebar.postMessageToSidebar({
      type: 'editor:activeChanged',
      filePath: editor.document.uri.fsPath,
      cursorLine: editor.selection.active.line,
      visibleRange: visibleRange
        ? {
            startLine: visibleRange.start.line,
            startCharacter: visibleRange.start.character,
            endLine: visibleRange.end.line,
            endCharacter: visibleRange.end.character,
          }
        : {
            startLine: editor.selection.active.line,
            startCharacter: 0,
            endLine: editor.selection.active.line,
            endCharacter: 0,
          },
      languageId: editor.document.languageId,
    })
  }

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(send),
  )

  // Also re-send when the sidebar panel becomes visible (user switches to it)
  const sidebarPanel = sidebar.panel
  if (sidebarPanel) {
    context.subscriptions.push(
      sidebarPanel.onDidChangeViewState(({ webviewPanel }) => {
        if (webviewPanel.visible) {
          send(vscode.window.activeTextEditor)
        }
      }),
    )
  }

  // Fire immediately so the first panel open already has context
  send(vscode.window.activeTextEditor)
}
