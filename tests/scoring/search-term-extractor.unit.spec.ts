import { describe, it, expect } from 'vitest'
import { extractSearchTerms } from '../../src/scoring/search-term-extractor.js'

describe('extractSearchTerms', () => {
  it('returns empty array for empty query', () => {
    expect(extractSearchTerms('')).toEqual([])
    expect(extractSearchTerms('   ')).toEqual([])
  })

  it('extracts simple tokens', () => {
    const result = extractSearchTerms('authentication authorization')
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ kind: 'token', value: 'authentication' })
    expect(result[1]).toEqual({ kind: 'token', value: 'authorization' })
  })

  it('extracts phrases in quotes', () => {
    const result = extractSearchTerms('"user login" authentication')
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ kind: 'phrase', value: 'user login' })
    expect(result[1]).toEqual({ kind: 'token', value: 'authentication' })
  })

  it('removes stopwords (English and German)', () => {
    const result = extractSearchTerms('the quick brown fox jumps over the lazy dog')
    const tokens = result.map((t) => t.value)
    expect(tokens).not.toContain('the')
    expect(tokens).not.toContain('over')
    expect(tokens).toContain('quick')
    expect(tokens).toContain('brown')
  })

  it('removes tokens shorter than 3 characters unless in allowlist', () => {
    const result = extractSearchTerms('ab abc go vue react')
    const tokens = result.map((t) => t.value)
    expect(tokens).not.toContain('ab')
    expect(tokens).toContain('abc')
    expect(tokens).toContain('react')
  })

  it('limits to 6 tokens (excluding phrases)', () => {
    const longQuery = 'alpha bravo charlie delta echo foxtrot golf hotel india juliet'
    const result = extractSearchTerms(longQuery)
    const tokens = result.filter((t) => t.kind === 'token')
    expect(tokens.length).toBeLessThanOrEqual(6)
  })

  it('preserves order and removes duplicates', () => {
    const result = extractSearchTerms('authentication database authentication security')
    const values = result.map((t) => t.value)
    expect(values).toEqual(['authentication', 'database', 'security'])
  })

  it('excludes phrase tokens from standalone tokens', () => {
    const result = extractSearchTerms('"user authentication" database authentication')

    expect(result[0]).toEqual({ kind: 'phrase', value: 'user authentication' })

    const tokens = result.filter((t) => t.kind === 'token').map((t) => t.value)
    expect(tokens).not.toContain('authentication')
    expect(tokens).toContain('database')
  })

  it('handles special characters and splits correctly', () => {
    const result = extractSearchTerms('user-authentication file_system data.processor')
    const tokens = result.map((t) => t.value)

    expect(tokens.some((t) => t.includes('authentication'))).toBe(true)
  })

  it('converts to lowercase', () => {
    const result = extractSearchTerms('Authentication DATABASE Security')
    expect(result.every((t) => t.value === t.value.toLowerCase())).toBe(true)
  })

  it('handles multiple phrases', () => {
    const result = extractSearchTerms('"user auth" "database connection" security')
    const phrases = result.filter((t) => t.kind === 'phrase')
    expect(phrases).toHaveLength(2)
    expect(phrases[0]?.value).toBe('user auth')
    expect(phrases[1]?.value).toBe('database connection')
  })
})
