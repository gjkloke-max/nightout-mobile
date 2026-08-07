/**
 * Generic city-token handling for geo parsing.
 * Standalone "Chicago" = broad city scope, not a partial match into longer place names.
 */

import { cleanNormalizedQuery } from './cleanNormalizedQuery.js'

/** @typedef {{ token: string, displayName: string }} GenericCityMarket */

/** @type {GenericCityMarket[]} */
export const GENERIC_CITY_MARKETS = [{ token: 'chicago', displayName: 'Chicago' }]

const LOCATION_AFTER_PREP =
  /\b(?:in|near|around|close to|by)\s+([^,.!?]+?)(?:\s+(?:for|with|that|who|where|when)\b|[,.!?]|$)/i

const TRAILING_LOCATION_AFTER_PREP = /\b(?:in|near|around|close to|by)\s+([^,.!?]+)$/i

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * @param {string|null|undefined} phrase
 */
export function isGenericCityToken(phrase) {
  const n = String(phrase || '')
    .trim()
    .toLowerCase()
  if (!n) return false
  return GENERIC_CITY_MARKETS.some((m) => m.token === n)
}

/**
 * @param {string|null|undefined} query
 */
export function extractLocationPhraseAfterPreposition(query) {
  const q = String(query || '').trim()
  if (!q) return null
  for (const pattern of [LOCATION_AFTER_PREP, TRAILING_LOCATION_AFTER_PREP]) {
    const m = q.match(pattern)
    if (m?.[1]) {
      const phrase = m[1]
        .trim()
        .replace(/\s+(?:area|neighborhood|district)$/i, '')
        .trim()
      if (phrase.length >= 2) return phrase
    }
  }
  return null
}

/**
 * @param {string|null|undefined} geoName
 */
export function geoEntityExtendsGenericCityToken(geoName) {
  const lower = String(geoName || '')
    .trim()
    .toLowerCase()
  if (!lower || isGenericCityToken(lower)) return false
  return GENERIC_CITY_MARKETS.some(({ token }) => new RegExp(`\\b${escapeRegExp(token)}\\b`, 'i').test(lower))
}

/**
 * @param {string|null|undefined} query
 * @param {string|null|undefined} geoName
 */
export function queryContainsFullGeoPhrase(query, geoName) {
  const q = String(query || '').trim()
  const name = String(geoName || '').trim()
  if (!q || !name) return false
  const re = new RegExp(`\\b${escapeRegExp(name).replace(/\s+/g, '\\s+')}\\b`, 'i')
  return re.test(q)
}

/**
 * @param {string|null|undefined} query
 */
export function queryHasExtendedCityGeoPhrase(query) {
  const q = String(query || '').trim()
  if (!q) return false
  for (const { token } of GENERIC_CITY_MARKETS) {
    const tokenRe = new RegExp(`\\b${escapeRegExp(token)}\\b`, 'gi')
    let m
    while ((m = tokenRe.exec(q))) {
      const start = m.index
      const end = start + m[0].length
      const before = q.slice(Math.max(0, start - 24), start)
      const after = q.slice(end, Math.min(q.length, end + 24))
      const prefix = before.match(/(?:^|\s)(\S+(?:\s+\S+)*)$/)?.[1] || ''
      const suffix = after.match(/^(\S+(?:\s+\S+)*?)(?:\s|$|[,.!?])/i)?.[1] || ''
      const extended = `${prefix} ${token} ${suffix}`.replace(/\s+/g, ' ').trim()
      if (extended && !isGenericCityToken(extended) && geoEntityExtendsGenericCityToken(extended)) {
        if (queryContainsFullGeoPhrase(q, extended)) return true
      }
      if (prefix.trim() && !isGenericCityToken(`${prefix.trim()} ${token}`.trim())) {
        const leftExtended = `${prefix.trim()} ${token}`.trim()
        if (
          geoEntityExtendsGenericCityToken(leftExtended) &&
          queryContainsFullGeoPhrase(q, leftExtended)
        ) {
          return true
        }
      }
      if (suffix.trim() && !isGenericCityToken(`${token} ${suffix.trim()}`.trim())) {
        const rightExtended = `${token} ${suffix.trim()}`.trim()
        if (
          geoEntityExtendsGenericCityToken(rightExtended) &&
          queryContainsFullGeoPhrase(q, rightExtended)
        ) {
          return true
        }
      }
    }
  }
  return false
}

/**
 * @param {string|null|undefined} query
 * @returns {GenericCityMarket|null}
 */
export function detectGenericCityScope(query) {
  const q = String(query || '').trim()
  if (!q) return null

  const extracted = extractLocationPhraseAfterPreposition(q)
  if (extracted && isGenericCityToken(extracted)) {
    return GENERIC_CITY_MARKETS.find((m) => m.token === extracted.toLowerCase()) || null
  }

  if (queryHasExtendedCityGeoPhrase(q)) return null

  for (const market of GENERIC_CITY_MARKETS) {
    const afterPrep = new RegExp(
      `\\b(?:in|near|around|close to|by)\\s+${escapeRegExp(market.token)}\\b(?!\\s+\\S)`,
      'i',
    )
    if (afterPrep.test(q)) return market
  }

  return null
}

/**
 * @param {string|null|undefined} spanRaw
 * @param {string|null|undefined} [message]
 */
export function spanIsGenericCityScopeLocation(spanRaw, message = null) {
  const span = String(spanRaw || '').trim()
  if (!span) return false
  if (isGenericCityToken(span)) return true
  for (const { token } of GENERIC_CITY_MARKETS) {
    if (new RegExp(`^(?:in|near|around|close to|by)\\s+${escapeRegExp(token)}$`, 'i').test(span)) {
      return true
    }
  }
  if (message && detectGenericCityScope(message)) {
    for (const { token } of GENERIC_CITY_MARKETS) {
      if (new RegExp(`\\b${escapeRegExp(token)}\\b`, 'i').test(span)) {
        const extracted = extractLocationPhraseAfterPreposition(message)
        if (extracted && isGenericCityToken(extracted)) return true
      }
    }
  }
  return false
}

/**
 * Block fuzzy location correction from standalone city scope to longer geo names.
 * @param {string|null|undefined} message
 * @param {string|null|undefined} candidateCanonical
 */
export function shouldBlockLocationCorrectionToExtendedCityEntity(message, candidateCanonical) {
  if (!queryMentionsStandaloneGenericCityToken(message)) return false
  if (!geoEntityExtendsGenericCityToken(candidateCanonical)) return false
  return !queryContainsFullGeoPhrase(message, candidateCanonical)
}

/**
 * @param {string|null|undefined} query
 */
export function queryMentionsStandaloneGenericCityToken(query) {
  return detectGenericCityScope(query) != null
}

/**
 * Reject longer geo names (North Chicago, Chicago Lawn) when the user only said the city token.
 * @param {string|null|undefined} query
 * @param {string|null|undefined} geoName
 */
export function shouldRejectPartialCityTokenGeoMatch(query, geoName) {
  const name = String(geoName || '').trim()
  if (!name || !geoEntityExtendsGenericCityToken(name)) return false
  if (queryContainsFullGeoPhrase(query, name)) return false
  return queryMentionsStandaloneGenericCityToken(query)
}

/**
 * @param {string|null|undefined} query
 */
export function stripGenericCityScopeFromQuery(query) {
  let q = String(query || '').trim()
  if (!q) return ''

  for (const { token } of GENERIC_CITY_MARKETS) {
    const scoped = new RegExp(
      `\\b(?:in|near|around|close to|by)\\s+${escapeRegExp(token)}\\b`,
      'gi',
    )
    q = q.replace(scoped, ' ')
    const bare = new RegExp(`\\b${escapeRegExp(token)}\\b`, 'gi')
    q = q.replace(bare, ' ')
  }

  q = q.replace(/\b(?:in|near|around|close to|by)\s*$/i, '')
  return cleanNormalizedQuery(q)
}
