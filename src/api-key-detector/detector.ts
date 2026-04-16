import * as vscode from 'vscode'
import { ok, err, type Result } from 'neverthrow'
import { KNOWN_SETTING_KEYS, API_KEY_REGEX } from './constants.js'
import { type DetectedApiKey, type DetectorResult, DetectionError } from './types.js'
import { logger } from '../logger.js'

/**
 * Detects AI API keys from VS Code User settings, Workspace settings, and .vscode/settings.json.
 */
export async function detectAiApiKeys(): Promise<Result<DetectorResult, DetectionError>> {
  try {
    const detected: DetectedApiKey[] = []

    // 1. Check known setting keys in User/Workspace configuration
    for (const key of KNOWN_SETTING_KEYS) {
      const config = vscode.workspace.getConfiguration()
      const info = config.inspect(key)

      // Check User (Global)
      if (typeof info?.globalValue === 'string' && info.globalValue.trim().length > 0) {
        detected.push({
          provider: key.split('.')[0] || 'unknown',
          key: info.globalValue.trim(),
          source: 'user-settings'
        })
      }

      // Check Workspace
      if (typeof info?.workspaceValue === 'string' && info.workspaceValue.trim().length > 0) {
        detected.push({
          provider: key.split('.')[0] || 'unknown',
          key: info.workspaceValue.trim(),
          source: 'workspace-settings'
        })
      }

      // Check Workspace Folder (.vscode/settings.json equivalent via API)
      if (typeof info?.workspaceFolderValue === 'string' && info.workspaceFolderValue.trim().length > 0) {
        detected.push({
          provider: key.split('.')[0] || 'unknown',
          key: info.workspaceFolderValue.trim(),
          source: 'dot-vscode-settings'
        })
      }
    }

    // 2. Heuristic: Scan .vscode/settings.json manually for unknown keys
    const workspaceFolders = vscode.workspace.workspaceFolders
    if (workspaceFolders) {
      for (const folder of workspaceFolders) {
        const settingsUri = vscode.Uri.joinPath(folder.uri, '.vscode', 'settings.json')
        try {
          const bytes = await vscode.workspace.fs.readFile(settingsUri)
          const content = Buffer.from(bytes).toString('utf8')
          const json = JSON.parse(content) as Record<string, unknown>

          for (const [key, value] of Object.entries(json)) {
            if (typeof value === 'string' && isAiKeyHeuristic(key, value)) {
              // Only add if not already detected from known keys
              const trimmedValue = value.trim()
              if (!detected.some(d => d.key === trimmedValue)) {
                detected.push({
                  provider: inferProvider(key),
                  key: trimmedValue,
                  source: 'dot-vscode-settings'
                })
              }
            }
          }
        } catch {
          // File might not exist or be invalid JSON, ignore
        }
      }
    }

    // 3. Deduplicate by provider (take the first one found per provider as requested)
    const uniqueByProvider = new Map<string, DetectedApiKey>()
    for (const d of detected) {
      if (!uniqueByProvider.has(d.provider)) {
        uniqueByProvider.set(d.provider, d)
      }
    }

    const finalResult = Array.from(uniqueByProvider.values())
    logger.log(`[detector] Detected ${finalResult.length} unique AI providers with API keys`)

    return ok(finalResult)
  } catch (e) {
    return err(new DetectionError('Failed to detect API keys', e))
  }
}

function isAiKeyHeuristic(key: string, value: string): boolean {
  const normalizedKey = key.toLowerCase()
  const isKeyLike = normalizedKey.includes('api') && normalizedKey.includes('key')
  const looksLikeKey = API_KEY_REGEX.test(value.trim())
  return isKeyLike || looksLikeKey
}

function inferProvider(key: string): string {
  const parts = key.split('.')
  if (parts.length > 1) return parts[0]!

  const knownProviders = ['openai', 'anthropic', 'claude', 'gemini', 'google', 'mistral', 'groq', 'together', 'perplexity', 'openrouter']
  const lowerKey = key.toLowerCase()
  for (const p of knownProviders) {
    if (lowerKey.includes(p)) return p
  }

  return 'unknown'
}
