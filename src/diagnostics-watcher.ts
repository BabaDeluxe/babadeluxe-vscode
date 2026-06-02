import * as vscode from 'vscode'
import type { BabaSidebarView } from './baba-sidebar-view.js'

/**
 * Watches VS Code language diagnostics and forwards errors/warnings for
 * files that are currently open to the webview as `editor:diagnostics`
 * messages.
 *
 * Diagnostics are stored by the webview in a silent map and merged into
 * the socket payload when the relevant file is in context — they never
 * appear as visible context chips.
 */
export function registerDiagnosticsWatcher(
  context: vscode.ExtensionContext,
  sidebar: BabaSidebarView,
): void {
  const sendDiagnosticsForUri = (uri: vscode.Uri): void => {
    if (uri.scheme !== 'file') return

    const allDiagnostics = vscode.languages.getDiagnostics(uri)
    const relevant = allDiagnostics.filter(
      (d) =>
        d.severity === vscode.DiagnosticSeverity.Error ||
        d.severity === vscode.DiagnosticSeverity.Warning,
    )

    // Always send even if empty so the webview can clear a stale entry
    void sidebar.postMessageToSidebar({
      type: 'editor:diagnostics',
      filePath: uri.fsPath,
      diagnostics: relevant.map((d) => ({
        message: d.message,
        severity: d.severity === vscode.DiagnosticSeverity.Error ? 'error' : 'warning',
        range: {
          startLine: d.range.start.line,
          startCharacter: d.range.start.character,
          endLine: d.range.end.line,
          endCharacter: d.range.end.character,
        },
        source: d.source,
        code:
          d.code == null
            ? undefined
            : typeof d.code === 'object'
              ? String(d.code.value)
              : String(d.code),
      })),
    })
  }

  context.subscriptions.push(
    vscode.languages.onDidChangeDiagnostics((event) => {
      for (const uri of event.uris) {
        sendDiagnosticsForUri(uri)
      }
    }),
  )

  // Seed diagnostics for the currently active editor on registration
  const activeUri = vscode.window.activeTextEditor?.document.uri
  if (activeUri) {
    sendDiagnosticsForUri(activeUri)
  }
}
