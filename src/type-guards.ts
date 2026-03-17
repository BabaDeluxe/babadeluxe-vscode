import type { WebviewMessage } from './types.js'

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

export const isWebviewMessage = (value: unknown): value is WebviewMessage =>
  isRecord(value) && typeof value['type'] === 'string'
