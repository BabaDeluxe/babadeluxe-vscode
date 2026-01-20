import * as vscode from 'vscode'
import { readFile } from './fs-helper.js'

export function createCspMeta(webview: vscode.Webview): string {
  const csp = [
    "default-src 'none'",
    `script-src ${webview.cspSource}`,
    `style-src ${webview.cspSource} 'unsafe-inline' https://fonts.googleapis.com`,
    `img-src ${webview.cspSource} https: data:`,
    `font-src ${webview.cspSource} https://fonts.gstatic.com`,
    `connect-src ${webview.cspSource} https: wss: ws:`,
  ].join('; ')
  return `<meta http-equiv="Content-Security-Policy" content="${csp}">`
}

export function replaceAssetPathsInHtml(
  html: string,
  webview: vscode.Webview,
  baseUri: vscode.Uri,
  assetFolder = 'dist/webview'
): string {
  const result = html.replaceAll(
    /(src|href)=["']\.\/([^"']+)["']/g,
    (_match, attr, relativePath: string) => {
      const assetUri = webview.asWebviewUri(vscode.Uri.joinPath(baseUri, assetFolder, relativePath))
      return ` ${attr}="${assetUri.toString()}"`
    }
  )

  return result
}

export async function loadAndProcessHtml(
  extensionUri: vscode.Uri,
  webview: vscode.Webview,
  assetFolder = 'dist/webview'
): Promise<string> {
  const htmlPath = vscode.Uri.joinPath(extensionUri, assetFolder, 'index.html')
  let html = await readFile(htmlPath.fsPath)

  html = html.replaceAll(/<meta[^>]*content-security-policy[^>]*>/gi, '')

  const ourCsp = createCspMeta(webview)

  html = html.replace('<head>', `<head>\n    ${ourCsp}`)

  html = replaceAssetPathsInHtml(html, webview, extensionUri, assetFolder)

  return html
}
