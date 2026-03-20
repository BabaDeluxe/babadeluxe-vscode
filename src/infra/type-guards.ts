import { type WebviewMessage } from '../webview/types.js'

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function isWebviewMessage(value: unknown): value is WebviewMessage {
  if (!isRecord(value)) return false
  const maybeMessage = value as Record<string, unknown>
  return typeof maybeMessage['type'] === 'string'
}
