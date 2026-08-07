/**
 * Detect location mentions in user queries and classify anchor type:
 * neighborhood_tag (community area) vs micro_neighborhood.
 *
 * When a phrase is a known micro and not a canonical community-area name (e.g. Old Town,
 * West Loop), micro_neighborhood wins. Canonical community names (Lake View, Lincoln Park) use neighborhood_tag.
 */

import { detectStrictNeighborhoodIntent } from './detectNeighborhoodIntent.js'
import {
  resolveNeighborhoodTag,
  resolveMicroNeighborhood,
  toDisplayLocationName,
  isKnownMicroNeighborhood,
  isCanonicalCommunityAreaName,
  isCommunityMatchSubsumedByMicro,
} from './locationRegistry.js'
import { canonicalNeighborhoodKey } from './locationConstants.js'
import { getCommunityAreaMatchers } from './locationRegistry.js'
import { findBroadRegionMentionInQuery, resolveBroadRegion } from './broadRegionStore.js'
import {
  detectGenericCityScope,
  shouldRejectPartialCityTokenGeoMatch,
  stripGenericCityScopeFromQuery,
} from './genericCityToken.js'

const LOCATION_EXTRACT_PATTERNS = [
  /\b(?:in|near|around|close to|by)\s+([^,.!?]+?)(?:\s+(?:for|with|that|who|where|when)\b|[,.!?]|$)/i,
  /\b(?:in|near|around)\s+([^,.!?]+)$/i,
  /\b([^,.!?]+?)\s+(?:area|neighborhood|district)\b/i,
]

const TRAILING_NOISE = /\s+(?:area|neighborhood|district)$/i

function emptyLocationResult(query) {
  return {
    location_mentioned: false,
    raw_location: null,
    normalized_location: null,
    location_intent: null,
    anchor_types: [],
    city_scope: null,
    query_without_location: query || '',
  }
}

function cityScopeLocationResult(query, cityScope) {
  return {
    location_mentioned: true,
    raw_location: cityScope.displayName,
    normalized_location: cityScope.displayName,
    location_intent: 'exact_first',
    anchor_types: ['city_scope'],
    city_scope: cityScope.displayName,
    query_without_location: stripGenericCityScopeFromQuery(query) || query || '',
    neighborhood_canonical: null,
    micro_neighborhood: null,
    broad_region: null,
  }
}

/**
 * @returns {{ raw: string, canonical: string } | null}
 */
function findNeighborhoodMentionInQuery(query) {
  const q = (query || '').trim()
  if (!q) return null

  for (const { area, canonicalKey } of getCommunityAreaMatchers()) {
    const re = new RegExp(`\\b${area.replace(/\s+/g, '\\s+')}\\b`, 'i')
    const m = q.match(re)
    if (m) {
      if (isCommunityMatchSubsumedByMicro(q, area)) continue
      if (shouldRejectPartialCityTokenGeoMatch(q, area) || shouldRejectPartialCityTokenGeoMatch(q, canonicalKey)) {
        continue
      }
      return { raw: m[0], canonical: canonicalKey }
    }
  }

  return null
}

/**
 * @param {string} query
 * @returns {string|null}
 */
export function extractLocationPhrase(query) {
  const q = (query || '').trim()
  if (!q) return null

  for (const pattern of LOCATION_EXTRACT_PATTERNS) {
    const m = q.match(pattern)
    if (m?.[1]) {
      const phrase = m[1].trim().replace(TRAILING_NOISE, '').trim()
      if (phrase.length >= 2) return phrase
    }
  }
  return null
}

const LOCATION_PREPOSITIONS = 'in|near|around|close to|by'

function stripRawLocationFromQuery(query, rawLocation) {
  if (!rawLocation) return (query || '').trim()
  const escaped = rawLocation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // Remove a leading preposition together with the location ("in Lakeview" -> "") so a dangling
  // "in"/"near"/etc. doesn't leak into the query when the location isn't at the end of the
  // sentence ("coffee shop in Lakeview with a good patio" -> "coffee shop with a good patio",
  // not "coffee shop in with a good patio"). Falls back to bare-location removal when no
  // preposition immediately precedes it (e.g. a comma-separated location).
  const withPrepositionRe = new RegExp(`\\b(?:${LOCATION_PREPOSITIONS})\\s+${escaped}\\b`, 'i')
  const bareRe = new RegExp(`\\b${escaped}\\b`, 'i')
  let out = withPrepositionRe.test(query) ? query.replace(withPrepositionRe, ' ') : query.replace(bareRe, ' ')
  out = out.replace(new RegExp(`\\b(?:${LOCATION_PREPOSITIONS})\\s*$`, 'i'), '').replace(/\s+/g, ' ').trim()
  return out
}

/**
 * @param {string} query
 */
export function detectLocationIntent(query) {
  const q = (query || '').trim()
  if (!q) return emptyLocationResult(q)

  const strict = detectStrictNeighborhoodIntent(q)
  const location_intent = strict ? 'exact_only' : null

  const cityScope = detectGenericCityScope(q)
  if (cityScope) {
    return {
      ...cityScopeLocationResult(q, cityScope),
      location_intent: location_intent || 'exact_first',
    }
  }

  const neighborhoodHit = findNeighborhoodMentionInQuery(q)
  const extractedPhrase = extractLocationPhrase(q)

  let raw_location = neighborhoodHit?.raw ?? extractedPhrase ?? null
  let neighborhood_canonical = neighborhoodHit?.canonical ?? null

  if (!neighborhood_canonical && extractedPhrase) {
    if (!shouldRejectPartialCityTokenGeoMatch(q, extractedPhrase)) {
      neighborhood_canonical = resolveNeighborhoodTag(extractedPhrase)
    }
  }

  if (!neighborhoodHit && !neighborhood_canonical) {
    const broadHit = findBroadRegionMentionInQuery(q)
    if (broadHit) {
      return {
        location_mentioned: true,
        raw_location: broadHit.raw,
        normalized_location: broadHit.region.name,
        location_intent: location_intent || 'exact_first',
        anchor_types: ['broad_region'],
        query_without_location: stripRawLocationFromQuery(q, broadHit.raw),
        neighborhood_canonical: null,
        micro_neighborhood: null,
        broad_region: broadHit.region,
      }
    }
    const fromPhrase = extractedPhrase ? resolveBroadRegion(extractedPhrase) : null
    if (fromPhrase) {
      return {
        location_mentioned: true,
        raw_location: extractedPhrase,
        normalized_location: fromPhrase.name,
        location_intent: location_intent || 'exact_first',
        anchor_types: ['broad_region'],
        query_without_location: stripRawLocationFromQuery(q, extractedPhrase),
        neighborhood_canonical: null,
        micro_neighborhood: null,
        broad_region: fromPhrase,
      }
    }
  }

  let micro = null
  if (extractedPhrase && isKnownMicroNeighborhood(extractedPhrase)) {
    if (!shouldRejectPartialCityTokenGeoMatch(q, extractedPhrase)) {
      micro = resolveMicroNeighborhood(extractedPhrase)
      raw_location = extractedPhrase
      if (!isCanonicalCommunityAreaName(extractedPhrase)) {
        neighborhood_canonical = null
      }
    }
  } else if (!micro && raw_location && isKnownMicroNeighborhood(raw_location)) {
    if (!shouldRejectPartialCityTokenGeoMatch(q, raw_location)) {
      micro = resolveMicroNeighborhood(raw_location)
    }
  }

  if (!micro && !neighborhood_canonical) {
    const microFromQuery = tryFindMicroInQuery(q)
    if (microFromQuery) {
      micro = microFromQuery.entry
      raw_location = raw_location || microFromQuery.raw
    }
  }

  const anchorPhrase = raw_location || extractedPhrase || micro?.name || ''
  if (!micro && anchorPhrase && !shouldRejectPartialCityTokenGeoMatch(q, anchorPhrase)) {
    micro = resolveMicroNeighborhood(anchorPhrase)
  }

  const preferMicro =
    Boolean(micro) &&
    !isCanonicalCommunityAreaName(anchorPhrase) &&
    !isCanonicalCommunityAreaName(micro.name)

  const hasNeighborhood = Boolean(neighborhood_canonical) && !preferMicro
  const hasMicro = Boolean(micro) && (preferMicro || !neighborhood_canonical)

  if (!hasNeighborhood && !hasMicro) {
    return emptyLocationResult(q)
  }

  const anchor_types = hasMicro ? ['micro_neighborhood'] : ['neighborhood_tag']

  let normalized_location = null
  if (hasNeighborhood) {
    normalized_location = toDisplayLocationName(neighborhood_canonical)
  } else if (micro) {
    normalized_location = toDisplayLocationName(raw_location || extractedPhrase || micro.name)
  }

  const query_without_location = stripRawLocationFromQuery(q, raw_location || '')

  return {
    location_mentioned: true,
    raw_location,
    normalized_location,
    location_intent: location_intent || 'exact_first',
    anchor_types,
    query_without_location,
    neighborhood_canonical: hasNeighborhood ? neighborhood_canonical : null,
    micro_neighborhood: hasMicro ? micro : null,
  }
}

function tryFindMicroInQuery(query) {
  const q = query.trim()
  const words = q.split(/\s+/)
  for (let len = Math.min(6, words.length); len >= 1; len--) {
    for (let i = 0; i <= words.length - len; i++) {
      const phrase = words.slice(i, i + len).join(' ')
      const entry = resolveMicroNeighborhood(phrase)
      if (entry) {
        if (shouldRejectPartialCityTokenGeoMatch(q, entry.name)) continue
        const re = new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
        const m = q.match(re)
        return { raw: m?.[0] || phrase, entry }
      }
    }
  }
  return null
}

/**
 * @param {ReturnType<typeof detectLocationIntent>} loc
 */
export function primaryLocationAnchorType(loc) {
  return loc?.anchor_types?.[0] ?? null
}

/**
 * @param {ReturnType<typeof detectLocationIntent>} loc
 */
export function locationAnchorName(loc) {
  if (!loc?.location_mentioned) return null
  if (loc.anchor_types.includes('city_scope')) return null
  if (loc.anchor_types.includes('broad_region') && loc.broad_region) {
    return loc.broad_region.slug || canonicalNeighborhoodKey(loc.broad_region.name)
  }
  if (loc.anchor_types.includes('neighborhood_tag')) return loc.neighborhood_canonical
  if (loc.micro_neighborhood) {
    return loc.micro_neighborhood.slug || canonicalNeighborhoodKey(loc.micro_neighborhood.name)
  }
  return loc.normalized_location ? canonicalNeighborhoodKey(loc.normalized_location) : null
}
