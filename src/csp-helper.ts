import { Buffer } from 'node:buffer'
import { randomBytes } from 'node:crypto'
import * as vscode from 'vscode'

export async function loadAndProcessHtml(
  extensionUri: vscode.Uri,
  webview: vscode.Webview
): Promise<string> {
  const htmlUri = vscode.Uri.joinPath(extensionUri, 'dist/webview/index.html')
  const htmlBytes = await vscode.workspace.fs.readFile(htmlUri)
  let html = Buffer.from(htmlBytes).toString('utf8')

  const nonce = randomBytes(16).toString('base64')
  html = html.replaceAll(
    /(src|href)=["']\.\/(assets\/[^"']+)["']/g,
    (_match, attr, relativePath: string) => {
      const assetUri = webview.asWebviewUri(
        vscode.Uri.joinPath(extensionUri, 'dist/webview', relativePath)
      )
      return `${attr}="${assetUri.toString()}"`
    }
  )
  html = html.replaceAll(
    /(src|href)=["']\/(assets\/[^"']+)["']/g,
    (_match, attr, relativePath: string) => {
      const assetUri = webview.asWebviewUri(
        vscode.Uri.joinPath(extensionUri, 'dist/webview', relativePath)
      )
      return `${attr}="${assetUri.toString()}"`
    }
  )

  const cspContent = [
    "default-src 'none'",
    `script-src ${webview.cspSource} 'nonce-${nonce}' 'wasm-unsafe-eval'`,
    `style-src ${webview.cspSource} 'nonce-${nonce}' 'unsafe-inline' https://fonts.googleapis.com`,
    `img-src ${webview.cspSource} https: data:`,
    `font-src ${webview.cspSource} https://fonts.gstatic.com`,
    `connect-src ${webview.cspSource} https: wss: ws:`,
    `worker-src ${webview.cspSource} blob:`,
  ].join('; ')

  html = html.includes('<meta http-equiv="Content-Security-Policy"')
    ? html.replace(
        /<meta http-equiv="Content-Security-Policy"[^>]*>/,
        `<meta http-equiv="Content-Security-Policy" content="${cspContent}">`
      )
    : html.replace(
        '<head>',
        `<head>\n<meta http-equiv="Content-Security-Policy" content="${cspContent}">`
      )

  html = html.replaceAll('<style', `<style nonce="${nonce}"`)
  html = html.replaceAll('<script', `<script nonce="${nonce}"`)

  return html
}
