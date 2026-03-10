import { Buffer } from 'node:buffer'
import { randomBytes } from 'node:crypto'
import { type Result, err, ok } from 'neverthrow'
import * as vscode from 'vscode'
import { logger } from './logger.js'
import { InitializationError } from './errors.js'

type LoadHtmlOptions = {
  extensionUri: vscode.Uri
  webview: vscode.Webview
  isDevelopmentMode: boolean
  webviewDevServerUrl: string | undefined
}

export async function loadAndProcessHtml(options: LoadHtmlOptions): Promise<string> {
  const { extensionUri, webview, isDevelopmentMode, webviewDevServerUrl } = options

  if (isDevelopmentMode && webviewDevServerUrl) {
    const devHtmlResult = await buildDevelopmentHtml(webview, webviewDevServerUrl)

    if (devHtmlResult.isOk()) {
      return devHtmlResult.value
    }

    logger.error('Failed to load webview HTML from dev server, falling back to production build', {
      error: devHtmlResult.error,
    })
  }

  const prodHtmlResult = await buildProductionHtml(extensionUri, webview)

  if (prodHtmlResult.isErr()) {
    logger.error('Failed to load webview HTML from production build', {
      error: prodHtmlResult.error,
    })

    // Last-resort: tiny inline HTML so the user doesn’t stare at a blank webview.
    // This is an initialization failure, so we surface *something*.
    return '<html><body><h1>Failed to load webview</h1></body></html>'
  }

  return prodHtmlResult.value
}

type BuildHtmlError = InitializationError

async function buildDevelopmentHtml(
  webview: vscode.Webview,
  devServerUrl: string
): Promise<Result<string, BuildHtmlError>> {
  try {
    const response = await fetch(devServerUrl)

    if (!response.ok) {
      return err(
        new InitializationError(
          `Failed to fetch dev index.html (${response.status} ${response.statusText})`,
          { status: response.status, statusText: response.statusText }
        )
      )
    }

    let html = await response.text()

    html = html.replace('<head>', `<head>\n<base href="${devServerUrl}/">`)

    const devServerHost = new URL(devServerUrl).host

    const cspContent = [
      "default-src 'none'",
      `script-src 'unsafe-eval' 'unsafe-inline' ${devServerUrl}`,
      `style-src ${webview.cspSource} 'unsafe-inline' ${devServerUrl}`,
      `img-src ${webview.cspSource} https: data: ${devServerUrl}`,
      `font-src ${webview.cspSource} https://fonts.gstatic.com ${devServerUrl}`,
      `connect-src ${devServerUrl} ws://${devServerHost} wss://${devServerHost} https: wss: ws:`,
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

    return ok(html)
  } catch (unknownError) {
    return err(new InitializationError('Failed to load dev webview HTML', unknownError))
  }
}

async function buildProductionHtml(
  extensionUri: vscode.Uri,
  webview: vscode.Webview
): Promise<Result<string, BuildHtmlError>> {
  try {
    const htmlUri = vscode.Uri.joinPath(extensionUri, 'dist/webview/index.html')
    const htmlBytes = await vscode.workspace.fs.readFile(htmlUri)
    let html = Buffer.from(htmlBytes).toString('utf8')

    const nonce = randomBytes(16).toString('base64')

    html = html.replaceAll(
      /(src|href)=["']\.\/(assets\/[^"']+)["']/g,
      (_match, attribute, relativePath: string) => {
        const assetUri = webview.asWebviewUri(
          vscode.Uri.joinPath(extensionUri, 'dist/webview', relativePath)
        )

        return `${attribute}="${assetUri.toString()}"`
      }
    )

    html = html.replaceAll(
      /(src|href)=["']\/(assets\/[^"']+)["']/g,
      (_match, attribute, relativePath: string) => {
        const assetUri = webview.asWebviewUri(
          vscode.Uri.joinPath(extensionUri, 'dist/webview', relativePath)
        )

        return `${attribute}="${assetUri.toString()}"`
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

    return ok(html)
  } catch (unknownError) {
    return err(new InitializationError('Failed to load production webview HTML', unknownError))
  }
}
