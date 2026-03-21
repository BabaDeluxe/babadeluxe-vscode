export const KNOWN_SETTING_KEYS = [
  // Continue
  'continue.models',
  'continue.apiBase',

  // Cody
  'cody.accessToken',
  'cody.serverEndpoint',

  // GitHub Copilot (usually handled via auth, but some settings might exist)
  'github.copilot.advanced',

  // Roo Code (formerly Cline)
  'roo-cline.apiKey',
  'roo-cline.apiProvider',

  // KiloCode
  'kilocode.apiKey',

  // Blackbox
  'blackbox.apiKey',

  // Generic / Others
  'openai.apiKey',
  'anthropic.apiKey',
  'gemini.apiKey',
  'mistral.apiKey',
  'groq.apiKey',
  'together.apiKey',
  'perplexity.apiKey',
  'openrouter.apiKey',
] as const

export const API_KEY_REGEX = /^(sk-[a-zA-Z0-9]{20,}|AIza[a-zA-Z0-9_-]{35}|[a-f0-9]{32,}|[A-Z0-9]{20,})$/
