/**
 * Detect neighborhood intent in a search query.
 * Matches Chicago community areas from public.neighborhoods only.
 * Colloquial micro names (West Loop, Old Town, Wicker Park) resolve via detectLocationIntent.js + micro_neighborhoods.
 */

import {
  getCommunityAreaMatchers,
  resolveNeighborhoodTag,
  isCommunityMatchSubsumedByMicro,
} from './locationRegistry.js'
import {
  detectGenericCityScope,
  shouldRejectPartialCityTokenGeoMatch,
  stripGenericCityScopeFromQuery,
} from './genericCityToken.js'

// Phrases that indicate STRICT neighborhood-only intent (no expansion allowed).
const STRICT_NEIGHBORHOOD_PATTERNS = [
  /\bonly\s+in\s+/i,
  /\bstrictly\s+in\s+/i,
  /\bexactly\s+in\s+/i,
  /\bwalkable\s+only\b/i,
  /\bwithin\s+walking\s+distance\b/i,
  /\bactually\s+in\s+(?:that\s+)?(?:the\s+)?neighborhood\b/i,
  /\bmust\s+be\s+in\s+/i,
  /\bno\s+(?:other\s+)?(?:areas?|neighborhoods?)\b/i,
]

/**
 * Detect if user wants strict in-neighborhood-only (no nearby expansion).
 * @param {string} query - Raw search query
 * @returns {boolean}
 */
export function detectStrictNeighborhoodIntent(query) {
  const q = (query || '').trim()
  if (!q) return false
  return STRICT_NEIGHBORHOOD_PATTERNS.some((re) => re.test(q))
}

/**
 * @param {string} query - Raw search query
 * @returns {{ detected: string | null, queryWithoutNeighborhood: string }}
 */
export function detectNeighborhoodIntent(query) {
  const q = (query || '').trim()
  if (!q) return { detected: null, queryWithoutNeighborhood: q }

  const cityScope = detectGenericCityScope(q)
  if (cityScope) {
    return {
      detected: null,
      queryWithoutNeighborhood: stripGenericCityScopeFromQuery(q) || q,
      city_scope: cityScope.displayName,
    }
  }

  for (const { area, canonicalKey } of getCommunityAreaMatchers()) {
    const re = new RegExp(`\\b${area.replace(/\s+/g, '\\s+')}\\b`, 'i')
    if (re.test(q)) {
      if (isCommunityMatchSubsumedByMicro(q, area)) continue
      if (shouldRejectPartialCityTokenGeoMatch(q, area) || shouldRejectPartialCityTokenGeoMatch(q, canonicalKey)) {
        continue
      }
      // Remove a leading preposition together with the neighborhood ("in Lakeview" -> "") so a
      // dangling "in"/"near"/etc. doesn't leak into the query when the neighborhood isn't at the
      // end of the sentence ("coffee shop in Lakeview with a good patio" -> "coffee shop with a
      // good patio", not "coffee shop in with a good patio").
      const withPrepositionRe = new RegExp(
        `\\b(?:in|near|around|close to|by)\\s+${area.replace(/\s+/g, '\\s+')}\\b`,
        'i',
      )
      const stripped = withPrepositionRe.test(q) ? q.replace(withPrepositionRe, ' ') : q.replace(re, ' ')
      const without = stripped.replace(/\s+/g, ' ').trim()
      return { detected: canonicalKey, queryWithoutNeighborhood: without || q }
    }
  }

  return { detected: null, queryWithoutNeighborhood: q }
}

/**
 * Split a retrieval string into dish/intent text vs neighborhood filter.
 * @param {string} query
 * @param {string|null} [explicitNeighborhood] - Canonical neighborhood when already resolved upstream
 */
export function stripNeighborhoodForRetrievalQuery(query, explicitNeighborhood = null) {
  const full = (query || '').trim()
  if (!full) return { intentQuery: '', neighborhood: explicitNeighborhood || null }

  const { detected, queryWithoutNeighborhood } = detectNeighborhoodIntent(full)
  const neighborhood = explicitNeighborhood || detected || null
  if (!neighborhood) return { intentQuery: full, neighborhood: null }

  let intentQuery = (queryWithoutNeighborhood || '').trim()
  if (explicitNeighborhood && intentQuery === full) {
    // Non-greedy and bounded by a following connector/punctuation/end-of-string so this only
    // consumes the location phrase itself, not everything after it ("in Lakeview with a good
    // patio" -> "with a good patio" stays intact, not swallowed into the stripped span).
    intentQuery = full
      .replace(
        /\s+\bin\s+[a-z0-9][a-z0-9'-]*(?:\s+[a-z0-9][a-z0-9'-]*)*?(?=\s+(?:with|for|that|who|where|when|near|around|close to|by)\b|[,.!?]|$)/i,
        '',
      )
      .trim()
  }
  intentQuery = intentQuery.replace(/\s+\bin\s*$/i, '').trim()
  if (!intentQuery) intentQuery = full

  return { intentQuery, neighborhood }
}

/**
 * Normalize a venue's neighborhood name to canonical community area for comparison.
 * @param {string|null|undefined} venueNeighborhood - Raw neighborhood from venue
 * @returns {string|null} Canonical community area (e.g. "LAKE VIEW") or null if unknown
 */
export function normalizeVenueNeighborhoodToCommunity(venueNeighborhood) {
  return resolveNeighborhoodTag(venueNeighborhood || '') || null
}
