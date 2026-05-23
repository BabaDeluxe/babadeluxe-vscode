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

// Matches well-known AI key prefixes only — avoids false positives from hex hashes, UUIDs, git SHAs.
// Covers: OpenAI (sk-...), Anthropic (sk-ant-...), Google AI (AIza...), Groq (gsk_...),
// OpenRouter (sk-or-...) and generic long alphanumeric tokens (min 32 chars, mixed case).
// The generic branch requires at least one uppercase letter ((?=.*[A-Z])) to exclude
// all-lowercase hex strings such as MD5 hashes, UUIDs without hyphens, and Git SHA-1s.
export const API_KEY_REGEX =
  /^(sk-(?:ant-|or-)?[\w-]{20,}|AIza[\w-]{35}|gsk_[a-zA-Z\d]{20,}|(?=[^-]*[A-Z])[a-zA-Z][\w-]{31,}[a-zA-Z\d])$/
