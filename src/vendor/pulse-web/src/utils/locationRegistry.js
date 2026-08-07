/**
 * Registries for resolving query location phrases to neighborhood_tag vs micro_neighborhood anchors.
 * Community areas load from public.neighborhoods (see neighborhoodRegistry.server.js).
 */

import { canonicalNeighborhoodKey } from './locationConstants.js'
import { isCommunityMatchSubsumedByMicro as isSubsumedByMicro } from './locationMatchUtils.js'

/** @typedef {{ micro_neighborhood_id?: number|null, name: string, slug: string }} MicroNeighborhoodEntry */

/** @type {Set<string>} */
let communityAreaKeys = new Set()

/** @type {Map<string, string>} */
let neighborhoodCanonicalByKey = new Map()

/** @type {{ area: string, canonicalKey: string }[]} */
let areaMatchers = []

/**
 * @param {{ communityAreas?: string[] }} payload
 */
export function applyNeighborhoodRegistry(payload = {}) {
  communityAreaKeys = new Set()
  neighborhoodCanonicalByKey = new Map()
  areaMatchers = []

  for (const area of payload.communityAreas || []) {
    const key = canonicalNeighborhoodKey(area)
    if (!key) continue
    communityAreaKeys.add(key)
    neighborhoodCanonicalByKey.set(key, key)
    areaMatchers.push({ area: String(area).trim().toLowerCase(), canonicalKey: key })
  }

  areaMatchers.sort((a, b) => b.area.length - a.area.length)
}

export function resetNeighborhoodRegistry() {
  applyNeighborhoodRegistry({ communityAreas: [] })
}

export function isNeighborhoodRegistryLoaded() {
  return communityAreaKeys.size > 0
}

export function getCommunityAreaMatchers() {
  return areaMatchers
}

/**
 * @param {string} input
 * @returns {string|null} canonical community-area key (neighborhood_tag)
 */
export function resolveNeighborhoodTag(input) {
  const key = canonicalNeighborhoodKey(input)
  if (!key) return null
  return neighborhoodCanonicalByKey.get(key) ?? null
}

/**
 * @param {MicroNeighborhoodEntry[]} entries
 */
export function applyMicroNeighborhoodRegistry(entries) {
  microByKey = new Map()
  for (const entry of entries) {
    const nameKey = canonicalNeighborhoodKey(entry.name)
    const slugKey = canonicalNeighborhoodKey(entry.slug || entry.name)
    if (nameKey) microByKey.set(nameKey, entry)
    if (slugKey) microByKey.set(slugKey, entry)
  }
}

/** @type {Map<string, MicroNeighborhoodEntry>} */
let microByKey = new Map()

export function resetMicroNeighborhoodRegistry() {
  microByKey = new Map()
}

export function isMicroNeighborhoodRegistryLoaded() {
  return microByKey.size > 0
}

/**
 * @param {string} input
 * @returns {MicroNeighborhoodEntry|null}
 */
export function resolveMicroNeighborhood(input) {
  const key = canonicalNeighborhoodKey(input)
  if (!key) return null
  return microByKey.get(key) ?? null
}

/**
 * @param {string} input
 * @returns {boolean}
 */
export function isKnownMicroNeighborhood(input) {
  return resolveMicroNeighborhood(input) != null
}

/** @returns {MicroNeighborhoodEntry[]} */
export function listMicroNeighborhoodEntries() {
  const seen = new Set()
  const out = []
  for (const entry of microByKey.values()) {
    const key = canonicalNeighborhoodKey(entry.name)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(entry)
  }
  return out.sort((a, b) => a.name.localeCompare(b.name))
}

export function isCommunityMatchSubsumedByMicro(query, communityAreaLower) {
  return isSubsumedByMicro(
    query,
    communityAreaLower,
    [...microByKey.values()].map((entry) => entry.name),
  )
}

/** True when the phrase is a Chicago community area proper name. */
export function isCanonicalCommunityAreaName(input) {
  const key = canonicalNeighborhoodKey(input)
  if (!key) return false
  return communityAreaKeys.has(key)
}

/**
 * @param {string} value
 */
export function toDisplayLocationName(value) {
  const s = String(value || '').trim()
  if (!s) return ''
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}
