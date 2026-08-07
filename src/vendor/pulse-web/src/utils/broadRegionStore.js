/**
 * In-memory cache for broad directional regions (North Side, West Side, etc.).
 * Load via broadRegionStore.server.js on the API, or applyBroadRegionData from tests.
 */

import { resolveNeighborhoodKey } from './neighborhoodNearbyStore.js'

/** @typedef {{ name: string, slug: string, neighborhoods: string[], aliases: string[] }} BroadRegionEntry */

/** @type {Map<string, BroadRegionEntry>} */
let regionByKey = new Map()

/** @type {Map<string, string>} alias -> regionKey */
let regionKeyByAlias = new Map()

/** @type {{ alias: string, regionKey: string, length: number }[]} */
let aliasMatchers = []

function regionKey(name) {
  return String(name || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ')
}

function aliasKey(alias) {
  return String(alias || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * @param {{ regions: BroadRegionEntry[] }} payload
 */
export function applyBroadRegionData(payload = {}) {
  regionByKey = new Map()
  regionKeyByAlias = new Map()
  aliasMatchers = []

  for (const region of payload.regions || []) {
    const key = regionKey(region.name)
    if (!key) continue
    const neighborhoods = [...new Set((region.neighborhoods || []).map((n) => resolveNeighborhoodKey(n)).filter(Boolean))]
    const aliases = [...new Set((region.aliases || []).map(aliasKey).filter(Boolean))]
    if (!aliases.includes(aliasKey(region.name))) aliases.push(aliasKey(region.name))
    if (region.slug && !aliases.includes(aliasKey(region.slug.replace(/_/g, ' ')))) {
      aliases.push(aliasKey(region.slug.replace(/_/g, ' ')))
    }
    regionByKey.set(key, {
      name: region.name,
      slug: region.slug || key.toLowerCase().replace(/\s+/g, '_'),
      neighborhoods,
      aliases,
    })
    for (const alias of aliases) {
      regionKeyByAlias.set(alias, key)
      aliasMatchers.push({ alias, regionKey: key, length: alias.length })
    }
  }

  aliasMatchers.sort((a, b) => b.length - a.length)
}

export function resetBroadRegionCache() {
  regionByKey = new Map()
  regionKeyByAlias = new Map()
  aliasMatchers = []
}

export function isBroadRegionCacheLoaded() {
  return regionByKey.size > 0
}

/**
 * @param {string|null|undefined} input
 * @returns {BroadRegionEntry|null}
 */
export function resolveBroadRegion(input) {
  const raw = String(input || '').trim()
  if (!raw) return null
  const byAlias = regionKeyByAlias.get(aliasKey(raw))
  if (byAlias) return regionByKey.get(byAlias) || null
  const byName = regionByKey.get(regionKey(raw))
  return byName || null
}

/**
 * Longest alias match in query (after community-area matching is ruled out).
 * @param {string} query
 * @returns {{ raw: string, region: BroadRegionEntry } | null}
 */
export function findBroadRegionMentionInQuery(query) {
  const q = (query || '').trim()
  if (!q || !aliasMatchers.length) return null

  for (const { alias, regionKey: rk } of aliasMatchers) {
    const re = new RegExp(`\\b${escapeRegExp(alias).replace(/\s+/g, '\\s+')}\\b`, 'i')
    const m = q.match(re)
    if (!m) continue
    const region = regionByKey.get(rk)
    if (region) return { raw: m[0], region }
  }
  return null
}

/**
 * @param {BroadRegionEntry|null|undefined} region
 * @returns {string[]}
 */
export function getBroadRegionNeighborhoodAllowlist(region) {
  if (!region?.neighborhoods?.length) return []
  return [...region.neighborhoods]
}

/**
 * @param {{ type?: string, name?: string, neighborhoods?: string[] }|null|undefined} anchor
 * @returns {string[]}
 */
export function getBroadRegionNeighborhoodAllowlistFromAnchor(anchor) {
  if (!anchor || anchor.type !== 'broad_region') return []
  if (Array.isArray(anchor.neighborhoods) && anchor.neighborhoods.length) {
    return anchor.neighborhoods.map((n) => resolveNeighborhoodKey(n)).filter(Boolean)
  }
  return getBroadRegionNeighborhoodAllowlist(resolveBroadRegion(anchor.name))
}

/** Built-in aliases when DB/CSV loader has not run (mirrors migrations/broad_regions.sql). */
export const DEFAULT_BROAD_REGION_ALIASES = {
  'North Side': [
    'north side',
    'northside',
    'the north side',
    'north side chicago',
  ],
  'West Side': ['west side', 'westside', 'the west side', 'west side chicago'],
  'South Side': ['south side', 'southside', 'the south side', 'south side chicago'],
  'Downtown / Central': [
    'downtown',
    'downtown central',
    'downtown / central',
    'central',
    'downtown chicago',
    'the loop area',
    'city center',
  ],
}
