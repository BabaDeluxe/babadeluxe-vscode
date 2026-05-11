import { describe, it, expect } from 'vitest'
import { API_KEY_REGEX } from '../src/api-key-detector/constants.js'

describe('API_KEY_REGEX', () => {
  describe('true positives — should match', () => {
    it.each([
      // OpenAI
      ['sk-proj-abcdefghij1234567890ABCD', 'OpenAI project key'],
      ['sk-abcdefghijklmnopqrst', 'OpenAI short key (20 chars after sk-)'],
      // Anthropic
      ['sk-ant-api03-abcdefghijklmnopqrstu', 'Anthropic key'],
      // OpenRouter
      ['sk-or-v1-abcdefghijklmnopqrstuvwxyz', 'OpenRouter key'],
      // Google AI
      ['AIzaSyAbcdefghijklmnopqrstuvwxyz123', 'Google AI key (35 chars after AIza)'],
      // Groq
      ['gsk_abcdefghijklmnopqrstuvwxyz123456', 'Groq key'],
      // Generic long mixed-case token
      ['xAbcDefGhiJklMnoPqrStuvWxyz1234567', 'Generic 34-char mixed-case token'],
    ])('%s (%s)', (key) => {
      expect(API_KEY_REGEX.test(key)).toBe(true)
    })
  })

  describe('false positives — must NOT match', () => {
    it.each([
      // MD5 hash — pure hex
      ['d41d8cd98f00b204e9800998ecf8427e', 'MD5 hash'],
      // UUID v4
      ['550e8400e29b41d4a716446655440000', 'UUID (no hyphens)'],
      // Git SHA
      ['a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2', 'Git SHA-1'],
      // Short random string (under 32 chars)
      ['shorttoken123', 'Too short'],
      // Empty string
      ['', 'Empty string'],
      // All lowercase hex (likely hash)
      ['abcdef1234567890abcdef1234567890', 'All lowercase hex — looks like MD5'],
    ])('%s (%s)', (key) => {
      expect(API_KEY_REGEX.test(key)).toBe(false)
    })
  })
})
