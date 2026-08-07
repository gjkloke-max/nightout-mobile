/**
 * Chicago neighborhood adjacency for adaptive geographic expansion.
 * Adjacency loads from public.neighborhood_nearby (see neighborhoodNearbyStore.js).
 *
 * Expansion includes the anchor plus all curated nearby communities (rank ignored).
 * Venue ordering uses rerank / rating scores — not CSV proximity rank.
 *
 * Proximity tiers (for local vs nearby labeling only):
 * - Tier 1: requested neighborhood
 * - Tier 2: any curated nearby neighbor
 * - Tier 4: outside the curated set
 */

import {
  getNeighborhoodAdjacency,
  getNeighborhoodAdjacencyMap,
  getProximityTiersForAnchor,
  getProximityTiersMap,
  isCuratedNearbyNeighbor,
  resolveNeighborhoodKey,
} from './neighborhoodNearbyStore.js'
import { toDisplayLocationName } from './locationRegistry.js'

/** @deprecated Use getNeighborhoodAdjacencyMap() — populated from neighborhood_nearby. */
export const NEIGHBORHOOD_ADJACENCY = new Proxy(
  {},
  {
    get(_target, prop) {
      if (typeof prop !== 'string') return undefined
      return getNeighborhoodAdjacency(prop)
    },
  },
)

/** @deprecated Use getProximityTiersForAnchor() — all neighbors treated equally. */
export const PROXIMITY_TIERS = new Proxy(
  {},
  {
    get(_target, prop) {
      if (typeof prop !== 'string') return undefined
      return getProximityTiersForAnchor(prop)
    },
  },
)

/**
 * Get display name for a neighborhood (canonical or raw).
 * @param {string} name - Raw or canonical neighborhood name
 * @returns {string} Human-readable name
 */
export function getNeighborhoodDisplayName(name) {
  if (!name) return ''
  const key = resolveNeighborhoodKey(name)
  return toDisplayLocationName(key || name)
}

/**
 * Anchor + all curated nearby communities for expansion allowlists.
 * @param {string} requestedNeighborhood - Canonical name (e.g. 'LINCOLN PARK')
 * @returns {string[]} [requested, ...all nearby]
 */
export function getExpandedNeighborhoods(requestedNeighborhood) {
  if (!requestedNeighborhood) return []
  const req = resolveNeighborhoodKey(requestedNeighborhood)
  const adj = getNeighborhoodAdjacency(req)
  if (!adj?.length) return [requestedNeighborhood]
  const seen = new Set([req])
  const result = [requestedNeighborhood]
  for (const n of adj) {
    const key = resolveNeighborhoodKey(n)
    if (!seen.has(key)) {
      seen.add(key)
      result.push(n)
    }
  }
  return result
}

/**
 * Human-readable geography summary for search API logs (SQL local filter vs adaptive expansion).
 */
export function getNeighborhoodScopeLogSummary(requestedCanonical, options = {}) {
  const hybridSql = options.hybridNeighborhoodFilter ?? null
  const strict = options.strictNeighborhoodIntent === true
  const homeGeoExpanded = options.homeGeoExpanded === true
  const req = resolveNeighborhoodKey(requestedCanonical || '')
  if (!req) {
    return {
      anchor_community_area: null,
      reviews_sql_p_neighborhood: hybridSql,
      strict_neighborhood_keyword: strict,
      implicit_home_geo_funnel: homeGeoExpanded,
      reference_communities: null,
      note: hybridSql
        ? 'effective_neighborhood in payload without parser anchor — SQL filter may still apply'
        : homeGeoExpanded
          ? 'implicit home/geo bubble: funnel allowlist (adjacent communities), hybrid without p_neighborhood when allowlist-only'
          : 'No neighborhood in query/payload — hybrid runs without neighborhood WHERE unless browse/top-rated path fills it',
    }
  }

  const adj = getNeighborhoodAdjacency(req)
  const expanded = getExpandedNeighborhoods(req)

  return {
    anchor_community_area: req,
    reviews_sql_p_neighborhood: hybridSql,
    strict_neighborhood_keyword: strict,
    implicit_home_geo_funnel: homeGeoExpanded,
    funnel_widened_no_sql_neighborhood: hybridSql == null && !strict,
    reference_communities: {
      expanded_allowlist: expanded.map((x) => resolveNeighborhoodKey(x)),
      curated_nearby_from_db: adj ?? null,
    },
    expansion_policy: strict
      ? 'Strict: tier-1 community match style (no adaptive merge to nearby).'
      : 'Soft: expand to anchor + all curated nearby communities; rank venues by search/rerank score (CSV rank ignored).',
  }
}

/**
 * Proximity tier for labeling/filtering: 1 = anchor, 2 = curated nearby, 4 = outside set.
 * Uses neighborhood_nearby only — no sub-area overrides.
 */
export function getProximityTier(venueNeighborhood, requestedNeighborhood, normalizeFn) {
  const req = resolveNeighborhoodKey(requestedNeighborhood || '')
  const raw = (venueNeighborhood || '').trim()
  const rawKey = resolveNeighborhoodKey(raw)
  const canonical = normalizeFn
    ? resolveNeighborhoodKey(normalizeFn(raw) || raw || '')
    : rawKey
  const displayName = getNeighborhoodDisplayName(raw) || raw || ''

  if (!req) return { tier: 4, canonical: rawKey, displayName }

  if (canonical === req) return { tier: 1, canonical, displayName }

  if (isCuratedNearbyNeighbor(req, canonical)) {
    return { tier: 2, canonical, displayName }
  }

  return { tier: 4, canonical, displayName }
}

export {
  getNeighborhoodAdjacency,
  getNeighborhoodAdjacencyMap,
  getProximityTiersForAnchor,
  getProximityTiersMap,
  isCuratedNearbyNeighbor,
} from './neighborhoodNearbyStore.js'
