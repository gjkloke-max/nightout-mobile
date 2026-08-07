/**
 * Concierge-specific location anchor resolution (user turn + search message + carried state).
 */

import { resolveLocationSearchAnchor } from './locationSearchAnchor.js'
import { detectLocationIntent } from './detectLocationIntent.js'

/**
 * @param {{
 *   userMessage?: string,
 *   searchMessage?: string,
 *   carriedNeighborhood?: string|null,
 *   searchMessageProvenance?: string|null,
 *   resolvedNeighborhoodList?: string[],
 *   carriedLocationArea?: string|null,
 * }} opts
 */
export function resolveConciergeExplicitLocationAnchor(opts = {}) {
  const userMessage = (opts.userMessage || '').trim()
  const searchMessage = (opts.searchMessage || '').trim()
  const carriedNeighborhood = (opts.carriedNeighborhood || '').trim()
  const searchMessageProvenance = opts.searchMessageProvenance || null
  const resolvedNeighborhoodList = Array.isArray(opts.resolvedNeighborhoodList)
    ? opts.resolvedNeighborhoodList
    : []

  const fromUser = userMessage ? resolveLocationSearchAnchor(userMessage) : null
  const fromSearch =
    searchMessage && searchMessageProvenance !== 'planner_standalone_query'
      ? resolveLocationSearchAnchor(searchMessage)
      : null

  const carriedLocationArea = (opts.carriedLocationArea || '').trim()

  let fromCarried = null
  const carriedLabel = carriedNeighborhood || carriedLocationArea
  if (carriedLabel) {
    fromCarried =
      resolveLocationSearchAnchor(`in ${carriedLabel}`) ||
      resolveLocationSearchAnchor(carriedLabel)
  }

  let fromResolved = null
  for (const item of resolvedNeighborhoodList) {
    const s = String(item || '').trim()
    if (!s) continue
    fromResolved =
      resolveLocationSearchAnchor(`in ${s}`) || resolveLocationSearchAnchor(s)
    if (fromResolved) break
  }

  const anchor = fromUser || fromSearch || fromCarried || fromResolved

  return {
    anchor,
    fromUser,
    fromSearch,
    neighborhoodCanonical: anchor?.type === 'neighborhood_tag' ? anchor.name : null,
  }
}

/**
 * @param {string} query
 */
export function queryWithoutLocationFromText(query) {
  const loc = detectLocationIntent(query || '')
  if (loc.location_mentioned) return loc.query_without_location || query
  return query
}

/**
 * Location phrase suitable for merging into a combined search string.
 * @param {import('./locationSearchAnchor.js').LocationSearchAnchor|null} anchor
 */
export function locationPhraseForQueryMerge(anchor) {
  if (!anchor) return null
  return (anchor.displayName || anchor.name || '').toLowerCase()
}

/**
 * Serialize anchor for /api/search request body.
 * @param {import('./locationSearchAnchor.js').LocationSearchAnchor|null} anchor
 */
export function serializeLocationAnchorForSearch(anchor) {
  if (!anchor) return null
  if (anchor.type === 'venue_radius') {
    return {
      type: 'venue_radius',
      lat: anchor.lat,
      lng: anchor.lng,
      radiusMiles: anchor.radiusMiles,
      ...(anchor.venueId != null ? { venueId: anchor.venueId } : {}),
      ...(anchor.venueName ? { venueName: anchor.venueName } : {}),
    }
  }
  return {
    type: anchor.type,
    name: anchor.name,
    displayName: anchor.displayName || anchor.name,
    ...(anchor.slug ? { slug: anchor.slug } : {}),
    ...(anchor.type === 'broad_region' && Array.isArray(anchor.neighborhoods)
      ? { neighborhoods: anchor.neighborhoods }
      : {}),
  }
}
