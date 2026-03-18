import { deu, eng, removeStopwords } from 'stopword'
import type { SearchTerm } from './types.js'
import { extraStopwords, shortTokenAllowlist } from '../infra/constants.js'

function tokenizeHumanText(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9äöüß._\-/:]+/iu)
    .map((token) => token.trim())
    .filter(Boolean)
}

function uniquePreserveOrder(values: readonly string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    if (seen.has(value)) continue
    seen.add(value)
    result.push(value)
  }

  return result
}

export function extractSearchTerms(query: string): SearchTerm[] {
  const trimmed = query.trim()
  if (!trimmed) return []

  const phraseMatches = [...trimmed.matchAll(/"([^"]+)"/g)]
  const phrases = uniquePreserveOrder(
    phraseMatches.map((match) => match[1]!.trim()).filter(Boolean)
  )

  const withoutPhrases = trimmed.replaceAll(/"[^"]+"/g, ' ')
  const rawTokens = tokenizeHumanText(withoutPhrases)

  const stopwords = new Set([...eng, ...deu])
  const tokensAfterStopwords = removeStopwords(rawTokens, [...stopwords]).filter(
    (token) => !extraStopwords.has(token)
  )

  const phraseTokenSet = new Set<string>()
  for (const phrase of phrases) {
    for (const token of tokenizeHumanText(phrase)) phraseTokenSet.add(token)
  }

  const filteredTokens = uniquePreserveOrder(tokensAfterStopwords)
    .filter((token) => !phraseTokenSet.has(token))
    .filter((token) => token.length >= 3 || shortTokenAllowlist.has(token))
    .slice(0, 6)

  const terms: SearchTerm[] = []
  for (const phrase of phrases) terms.push({ kind: 'phrase', value: phrase })
  for (const token of filteredTokens) terms.push({ kind: 'token', value: token })

  return terms
}
