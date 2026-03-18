// @ts-expect-error No declaration file
import { type WinkBm25Engine } from 'wink-bm25-text-search'

export type EngineWithMapping = {
  readonly engine: WinkBm25Engine
  readonly idToPath: string[]
}

/**
 * Structural contract to avoid importing the concrete class here (breaks cycles).
 */
export type Bm25IndexServiceLike = Readonly<{
  loadCacheIfPossible: () => Promise<unknown>
  rebuildInBackground: () => Promise<unknown>
  searchAdaptiveCandidates: (query: string) => ScoredCandidate[]
}>

export type Bm25RuntimeHandle = Readonly<{
  bm25IndexService: Bm25IndexServiceLike
  dispose: () => void
}>

import { ScoredCandidate } from '../scoring/types.js'
