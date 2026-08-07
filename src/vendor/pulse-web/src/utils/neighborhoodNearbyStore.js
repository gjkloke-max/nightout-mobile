/**
 * In-memory cache for public.neighborhood_nearby (browser + Node safe).
 * Load via neighborhoodNearbyStore.server.js on the API, or applyNeighborhoodNearbyRows from tests.
 */

import { resolveNeighborhoodTag } from './locationRegistry.js'

/** @type {Record<string, string[]>} */
let adjacencyByAnchor = {}

/** @type {Record<string, Set<string>>} */
let nearbySetByAnchor = {}

export function canonicalNeighborhoodKey(name) {
  return String(name || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ')
}

export function resolveNeighborhoodKey(name) {
  return resolveNeighborhoodTag(name) ?? canonicalNeighborhoodKey(name)
}

/**
 * @param {{ anchor_name: string; nearby_name: string; rank?: number }[]} rows
 */
export function applyNeighborhoodNearbyRows(rows) {
  /** @type {Record<string, { nearby: string; rank: number }[]>} */
  const grouped = {}

  for (const row of rows) {
    const anchor = resolveNeighborhoodKey(row.anchor_name)
    const nearby = resolveNeighborhoodKey(row.nearby_name)
    if (!anchor || !nearby || anchor === nearby) continue
    if (!grouped[anchor]) grouped[anchor] = []
    grouped[anchor].push({
      nearby,
      rank: Number(row.rank) || grouped[anchor].length + 1,
    })
  }

  const nextAdjacency = {}
  const nextNearbySet = {}

  for (const [anchor, entries] of Object.entries(grouped)) {
    entries.sort((a, b) => a.rank - b.rank)
    const ordered = []
    const seen = new Set()
    for (const entry of entries) {
      if (seen.has(entry.nearby)) continue
      seen.add(entry.nearby)
      ordered.push(entry.nearby)
    }
    nextAdjacency[anchor] = ordered
    nextNearbySet[anchor] = new Set(ordered)
  }

  adjacencyByAnchor = nextAdjacency
  nearbySetByAnchor = nextNearbySet
}

export function resetNeighborhoodNearbyCache() {
  adjacencyByAnchor = {}
  nearbySetByAnchor = {}
}

export function isNeighborhoodNearbyCacheLoaded() {
  return Object.keys(adjacencyByAnchor).length > 0
}

export function getNeighborhoodAdjacencyMap() {
  return adjacencyByAnchor
}

/** @param {string} anchor */
export function getNeighborhoodAdjacency(anchor) {
  return adjacencyByAnchor[resolveNeighborhoodKey(anchor)] ?? null
}

/** @param {string} anchor @param {string} nearbyCanonical */
export function isCuratedNearbyNeighbor(anchor, nearbyCanonical) {
  const set = nearbySetByAnchor[resolveNeighborhoodKey(anchor)]
  if (!set) return false
  return set.has(resolveNeighborhoodKey(nearbyCanonical))
}

/** Backward compat — all curated neighbors are tier-2 equivalents; no rank split. */
export function getProximityTiersForAnchor(anchor) {
  const adj = getNeighborhoodAdjacency(anchor)
  if (!adj?.length) return null
  return { tier2: [...adj], tier3: [] }
}

export function getProximityTiersMap() {
  const out = {}
  for (const anchor of Object.keys(adjacencyByAnchor)) {
    out[anchor] = getProximityTiersForAnchor(anchor)
  }
  return out
}
