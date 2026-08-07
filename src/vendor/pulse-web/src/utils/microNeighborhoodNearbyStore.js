/**
 * In-memory cache for public.micro_neighborhood_nearby (browser + Node safe).
 */

import { canonicalNeighborhoodKey } from './locationConstants.js'

/** @type {Record<string, string[]>} */
let adjacencyByAnchor = {}

/** @type {Record<string, Set<string>>} */
let nearbySetByAnchor = {}

export function resolveMicroNeighborhoodKey(name) {
  return canonicalNeighborhoodKey(name)
}

/**
 * @param {{ anchor_name: string; nearby_name: string; rank?: number }[]} rows
 */
export function applyMicroNeighborhoodNearbyRows(rows) {
  /** @type {Record<string, { nearby: string; rank: number }[]>} */
  const grouped = {}

  for (const row of rows) {
    const anchor = resolveMicroNeighborhoodKey(row.anchor_name)
    const nearby = resolveMicroNeighborhoodKey(row.nearby_name)
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

export function resetMicroNeighborhoodNearbyCache() {
  adjacencyByAnchor = {}
  nearbySetByAnchor = {}
}

export function isMicroNeighborhoodNearbyCacheLoaded() {
  return Object.keys(adjacencyByAnchor).length > 0
}

export function getMicroNeighborhoodAdjacencyMap() {
  return adjacencyByAnchor
}

/** @param {string} anchor */
export function getMicroNeighborhoodAdjacency(anchor) {
  return adjacencyByAnchor[resolveMicroNeighborhoodKey(anchor)] ?? null
}

/** @param {string} anchor @param {string} nearbyCanonical */
export function isCuratedNearbyMicroNeighbor(anchor, nearbyCanonical) {
  const set = nearbySetByAnchor[resolveMicroNeighborhoodKey(anchor)]
  if (!set) return false
  return set.has(resolveMicroNeighborhoodKey(nearbyCanonical))
}

/**
 * Anchor + curated nearby micro-neighborhoods for expansion allowlists.
 * @param {string} requestedMicro - Display or slug name (e.g. 'Roscoe Village')
 * @returns {string[]} normalized keys for matching
 */
export function getExpandedMicroNeighborhoods(requestedMicro) {
  if (!requestedMicro) return []
  const req = resolveMicroNeighborhoodKey(requestedMicro)
  const adj = getMicroNeighborhoodAdjacency(req)
  if (!adj?.length) return [req]
  const seen = new Set([req])
  const result = [req]
  for (const n of adj) {
    const key = resolveMicroNeighborhoodKey(n)
    if (!seen.has(key)) {
      seen.add(key)
      result.push(key)
    }
  }
  return result
}

/**
 * Proximity tier for micro-neighborhood anchors (mirrors neighborhoodAdjacency.getProximityTier).
 */
export function getMicroProximityTier(venueMicroName, requestedMicro) {
  const req = resolveMicroNeighborhoodKey(requestedMicro || '')
  const raw = (venueMicroName || '').trim()
  const rawKey = resolveMicroNeighborhoodKey(raw)
  const displayName = raw || ''

  if (!req) return { tier: 4, canonical: rawKey, displayName }

  if (rawKey === req) return { tier: 1, canonical: rawKey, displayName }

  if (isCuratedNearbyMicroNeighbor(req, rawKey)) {
    return { tier: 2, canonical: rawKey, displayName }
  }

  return { tier: 4, canonical: rawKey, displayName }
}
