/**
 * Location-aware recommendation policy for Chicago.
 * Applies distance-based filtering and reranking based on user home location.
 *
 * Modes:
 * - explicit_neighborhood_mode: User requested a neighborhood; apply neighborhood filter, no home-distance cutoff
 * - broad_geo_mode: User said "anywhere", "doesn't matter where", etc.; no home-distance cutoff
 * - default_geo_mode: 0-3.5 mi = strong preference, 3.5-6 mi = acceptable, >6 mi = hard cutoff
 */

import { detectNeighborhoodIntent } from './detectNeighborhoodIntent.js'
import {
  isVenueInExpandedNeighborhoodScope,
  isVenueInStrictNeighborhoodMatch,
} from './neighborhoodExpansionFilter.js'

/** Normalize venue_id for comparison (handles pg bigint string vs Supabase number) */
function toVenueId(x) {
  if (x == null) return null
  if (typeof x === 'number' && !isNaN(x)) return x
  const n = parseInt(String(x), 10)
  return isNaN(n) ? null : n
}

/** Haversine distance in miles */
export function computeDistanceMiles(lat1, lng1, lat2, lng2) {
  if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) return null
  const a = parseFloat(lat1)
  const b = parseFloat(lng1)
  const c = parseFloat(lat2)
  const d = parseFloat(lng2)
  if (isNaN(a) || isNaN(b) || isNaN(c) || isNaN(d)) return null
  const R = 3958.8 // Earth radius in miles
  const toRad = (x) => (x * Math.PI) / 180
  const dLat = toRad(c - a)
  const dLng = toRad(d - b)
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(a)) * Math.cos(toRad(c)) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const y = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
  return R * y
}

/**
 * Coarse lat/lng bounding box around a point, for a cheap SQL prefilter — not a precise
 * circle. Callers that need exact distance should filter/sort with computeDistanceMiles
 * on whatever the box admits.
 */
export function computeLatLngBoundingBox(lat, lng, radiusMiles) {
  const a = parseFloat(lat)
  const b = parseFloat(lng)
  const r = parseFloat(radiusMiles)
  if (isNaN(a) || isNaN(b) || isNaN(r) || r <= 0) return null
  const MILES_PER_DEGREE_LAT = 69.0
  const latDelta = r / MILES_PER_DEGREE_LAT
  const cosLat = Math.cos((a * Math.PI) / 180)
  const milesPerDegreeLng = MILES_PER_DEGREE_LAT * Math.max(cosLat, 0.01)
  const lngDelta = r / milesPerDegreeLng
  return {
    minLat: a - latDelta,
    maxLat: a + latDelta,
    minLng: b - lngDelta,
    maxLng: b + lngDelta,
  }
}

const BROAD_GEO_PATTERNS = [
  /\b(?:doesn't|does not|don't|do not)\s+(?:have to be|need to be)\s+close\b/i,
  /\banywhere\s+(?:in\s+)?(?:the\s+)?(?:city|chicago)?\b/i,
  /\banywhere\b/i,
  /\bI\s+don't\s+care\s+(?:where|about\s+(?:the\s+)?location)\b/i,
  /\b(?:location|distance)\s+(?:doesn't|does not|don't|do not)\s+matter\b/i,
  /\bworth\s+the\s+trip\b/i,
  /\b(?:open\s+to|willing\s+to)\s+(?:drive|travel)\s+(?:anywhere|far)\b/i,
  /\b(?:no|any)\s+particular\s+location\s+preference\b/i,
  /\bcitywide\b/i,
  /\bnot\s+just\s+nearby\b/i,
]

/**
 * Detect if user explicitly said distance/location doesn't matter.
 * @param {string} query
 * @returns {boolean}
 */
export function detectBroadGeoIntent(query) {
  const q = (query || '').trim()
  if (!q) return false
  return BROAD_GEO_PATTERNS.some((re) => re.test(q))
}

/**
 * True when the user is asking for results around their home / current self ("near me", "nearby", …).
 * Used by concierge to scope search to profile home + adjacent communities. Returns false if the text
 * already names a canonical neighborhood (that path is explicit area, not "near me").
 *
 * @param {string} text
 * @returns {boolean}
 */
export function detectConciergeNearMeHomeIntent(text) {
  const q = (text || '').trim()
  if (!q) return false
  if (detectBroadGeoIntent(q)) return false
  if (detectNeighborhoodIntent(q).detected) return false
  const lower = q.toLowerCase()
  const patterns = [
    /\bnear\s+me\b/i,
    /\bclose\s+to\s+me\b/i,
    /\b(?:close\s+|right\s+)?by\s+me\b/i,
    /\baround\s+me\b/i,
    /\bnear\s+my\s+/i,
    /\baround\s+my\s+/i,
    /\bin\s+my\s+area\b/i,
    /\bin\s+my\s+neighborhood\b/i,
    /\bmy\s+neighborhood\b/i,
    /\bmy\s+home\s+neighborhood\b/i,
    /\bnearby\b/i,
    /\bclose[\s-]?by\b/i,
    /\bwalking\s+distance\b/i,
    /\bnear\s+here\b/i,
    /\baround\s+here\b/i,
    /\bnear\s+(?:my\s+)?home\b/i,
    /\bclose\s+to\s+(?:my\s+)?home\b/i,
    /\bin\s+the\s+area\b/i,
    /\blocal\s+area\b/i,
  ]
  return patterns.some((re) => re.test(lower))
}

export const GEO_MODE_EXPLICIT_NEIGHBORHOOD = 'explicit_neighborhood_mode'
export const GEO_MODE_BROAD = 'broad_geo_mode'
export const GEO_MODE_DEFAULT = 'default_geo_mode'

/**
 * Determine search mode from query and detected neighborhood.
 * @param {string} query - Raw search query
 * @param {string|null} detectedNeighborhood - From detectNeighborhoodIntent
 * @returns {'explicit_neighborhood_mode'|'broad_geo_mode'|'default_geo_mode'}
 */
export function getGeoMode(query, detectedNeighborhood) {
  if (detectedNeighborhood) return GEO_MODE_EXPLICIT_NEIGHBORHOOD
  if (detectBroadGeoIntent(query)) return GEO_MODE_BROAD
  return GEO_MODE_DEFAULT
}

/**
 * Search context for geo assumptions. Used for filtering, follow-up preservation, and debugging.
 * @typedef {Object} GeoSearchContext
 * @property {string|null} active_neighborhood_name - Canonical neighborhood when explicit
 * @property {boolean} broad_geo_override - User said "anywhere", "doesn't have to be close", etc.
 * @property {boolean} using_home_geo_default - Using home-based distance cutoff
 * @property {string|null} user_home_neighborhood_name - User's home neighborhood (for context)
 * @property {number|null} user_home_lat - User home lat
 * @property {number|null} user_home_lng - User home lng
 * @property {string} mode - explicit_neighborhood_mode | broad_geo_mode | default_geo_mode
 */

/**
 * Build full geo search context from query, optional prior context, and user home.
 * For "more options" follow-ups, pass usePriorContext=true to preserve geo assumptions.
 * For new neighborhood or broad-geo in current message, overrides prior.
 *
 * @param {Object} params
 * @param {string} params.query - Current search query (or combined query for refinements)
 * @param {GeoSearchContext|null} [params.priorContext] - From last search (use when "more options")
 * @param {boolean} [params.usePriorContext] - When true, preserve prior geo assumptions (for "more" follow-ups)
 * @param {{ homeNeighborhoodName?: string|null, lat?: number|null, lng?: number|null }} [params.userHome] - User home from profile
 * @returns {GeoSearchContext}
 */
export function buildGeoContext({ query, priorContext = null, usePriorContext = false, userHome = {} }) {
  if (usePriorContext && priorContext) {
    return {
      ...priorContext,
      user_home_neighborhood_name: userHome.homeNeighborhoodName ?? priorContext.user_home_neighborhood_name ?? null,
      user_home_lat: userHome.lat ?? priorContext.user_home_lat ?? null,
      user_home_lng: userHome.lng ?? priorContext.user_home_lng ?? null,
    }
  }

  const { detected: explicitNeighborhood } = detectNeighborhoodIntent(query || '')
  const broadGeoIntent = detectBroadGeoIntent(query || '')

  // New neighborhood in current message overrides prior
  const activeNeighborhood = explicitNeighborhood ?? priorContext?.active_neighborhood_name ?? null
  // Broad geo in current message overrides prior
  const broadGeoOverride = broadGeoIntent || priorContext?.broad_geo_override || false

  const mode = activeNeighborhood
    ? GEO_MODE_EXPLICIT_NEIGHBORHOOD
    : broadGeoOverride
      ? GEO_MODE_BROAD
      : GEO_MODE_DEFAULT

  const usingHomeGeoDefault = mode === GEO_MODE_DEFAULT

  return {
    active_neighborhood_name: activeNeighborhood,
    broad_geo_override: broadGeoOverride,
    using_home_geo_default: usingHomeGeoDefault,
    user_home_neighborhood_name: userHome.homeNeighborhoodName ?? priorContext?.user_home_neighborhood_name ?? null,
    user_home_lat: userHome.lat ?? priorContext?.user_home_lat ?? null,
    user_home_lng: userHome.lng ?? priorContext?.user_home_lng ?? null,
    mode,
  }
}

/**
 * When geo context has an explicit neighborhood (e.g. preserved from a prior turn) but the search
 * string no longer mentions it (e.g. "gluten free pizza" follow-up), append the canonical token so
 * Node /api/search sees neighborhood intent and embeddings stay local.
 * @param {string} searchQuery
 * @param {string|null|undefined} activeNeighborhoodCanonical - e.g. "LAKE VIEW"
 * @returns {string}
 */
export function appendCanonicalNeighborhoodToSearchQuery(searchQuery, activeNeighborhoodCanonical) {
  if (!activeNeighborhoodCanonical) return (searchQuery || '').trim()
  const q = (searchQuery || '').trim()
  if (detectNeighborhoodIntent(q).detected) return q
  const token = String(activeNeighborhoodCanonical).toLowerCase().replace(/_/g, ' ')
  return `${q} ${token}`.trim()
}

const MILES_STRONG = 3.5
const MILES_CUTOFF = 6
const GEO_BOOST_STRONG = 0.12
const GEO_PENALTY_MILD = -0.05
const MIN_DEFAULT_GEO_RESULTS = 5 // If fewer than this within 6 mi, include farther venues

/**
 * Apply geo policy: filter and/or rerank venues by distance from user home.
 * @param {Object} params
 * @param {Array<{venue_id: number, similarity?: number, [key: string]: unknown}>} params.reviews - Reviews with venue_id
 * @param {Array<{venue_id: number, latitude?: number|null, longitude?: number|null, neighborhood_name?: string|null, [key: string]: unknown}>} params.venues - Venues with coords
 * @param {{ lat: number|null, lng: number|null }} params.homeLocation - User home (lat/lng or centroid)
 * @param {string} params.mode - explicit_neighborhood_mode | broad_geo_mode | default_geo_mode
 * @param {string|null} [params.requestedNeighborhood] - Canonical neighborhood name when in explicit_neighborhood_mode
 * @param {boolean} [params.expansionTriggered] - When true, server expanded to nearby; do not filter by neighborhood (results already blended)
 * @returns {{ reviews: Array, venues: Array, venueDistances: Map<number, number> }}
 */
export function applyGeoPolicy({ reviews, venues, homeLocation, mode, requestedNeighborhood = null, expansionTriggered = false }) {
  const venueDistances = new Map()
  const homeLat = homeLocation?.lat
  const homeLng = homeLocation?.lng
  const hasHome = homeLat != null && homeLng != null

  // Add distance_miles to each venue for debugging (use normalized venue_id for Map keys)
  const venuesWithDistance = venues.map((v) => {
    const lat = v.latitude != null ? parseFloat(v.latitude) : null
    const lng = v.longitude != null ? parseFloat(v.longitude) : null
    const dist = hasHome && lat != null && lng != null ? computeDistanceMiles(homeLat, homeLng, lat, lng) : null
    const vid = toVenueId(v.venue_id)
    if (dist != null && vid != null) venueDistances.set(vid, dist)
    return { ...v, distance_miles: dist }
  })

  if (mode === GEO_MODE_EXPLICIT_NEIGHBORHOOD) {
    // When expansionTriggered, server merged local + citywide rows; drop tier-4 and suburbs so "nearby" stays plausible.
    if (expansionTriggered && requestedNeighborhood) {
      const matchingVenueIds = new Set(
        venuesWithDistance
          .filter((v) => isVenueInExpandedNeighborhoodScope(v.neighborhood_name, requestedNeighborhood))
          .map((v) => toVenueId(v.venue_id))
          .filter((id) => id != null)
      )
      const filteredVenues = venuesWithDistance.filter((v) => matchingVenueIds.has(toVenueId(v.venue_id)))
      const filteredReviews = reviews.filter((r) => matchingVenueIds.has(toVenueId(r.venue_id)))
      return { reviews: filteredReviews, venues: filteredVenues, venueDistances }
    }
    if (expansionTriggered) {
      return { reviews, venues: venuesWithDistance, venueDistances }
    }
    // Filter by requested neighborhood; no home-distance cutoff
    if (requestedNeighborhood) {
      // No venue rows (e.g. DB miss) — do not strip all reviews; we cannot match neighborhood.
      if (venuesWithDistance.length === 0 && reviews.length > 0) {
        return { reviews, venues: venuesWithDistance, venueDistances }
      }
      const matchingVenueIds = new Set(
        venuesWithDistance
          .filter((v) => isVenueInStrictNeighborhoodMatch(v.neighborhood_name, requestedNeighborhood))
          .map((v) => toVenueId(v.venue_id))
          .filter((id) => id != null)
      )
      const filteredVenues = venuesWithDistance.filter((v) => matchingVenueIds.has(toVenueId(v.venue_id)))
      const filteredReviews = reviews.filter((r) => matchingVenueIds.has(toVenueId(r.venue_id)))
      return { reviews: filteredReviews, venues: filteredVenues, venueDistances }
    }
    return { reviews, venues: venuesWithDistance, venueDistances }
  }

  if (mode === GEO_MODE_BROAD) {
    // No cutoff; optionally keep small distance tie-break (we'll use distance as tie-breaker only)
    return { reviews, venues: venuesWithDistance, venueDistances }
  }

  // default_geo_mode: exclude >6 miles, apply geo boost/penalty
  if (!hasHome) {
    return { reviews, venues: venuesWithDistance, venueDistances }
  }

  // No venue rows (coords unknown) — distance filter would empty all reviews (withinCutoff stays [] and
  // the "expand pool" branch does not run when venuesWithDistance.length === 0). Keep search results.
  if (venuesWithDistance.length === 0 && reviews.length > 0) {
    return { reviews, venues: venuesWithDistance, venueDistances }
  }

  let withinCutoff = venuesWithDistance.filter((v) => {
    const d = v.distance_miles
    return d != null && d <= MILES_CUTOFF
  })
  // If very few within 6 mi, include farther venues so user has options
  if (withinCutoff.length < MIN_DEFAULT_GEO_RESULTS && venuesWithDistance.length > withinCutoff.length) {
    withinCutoff = venuesWithDistance
  }
  const withinCutoffIds = new Set(withinCutoff.map((v) => toVenueId(v.venue_id)).filter((id) => id != null))
  const filteredReviews = reviews.filter((r) => withinCutoffIds.has(toVenueId(r.venue_id)))

  // Rerank: apply geo boost/penalty to similarity (closer = higher rank)
  const boostedReviews = filteredReviews.map((r) => {
    const dist = venueDistances.get(toVenueId(r.venue_id))
    let sim = r.similarity ?? 0
    if (dist != null) {
      if (dist <= MILES_STRONG) sim += GEO_BOOST_STRONG
      else if (dist <= MILES_CUTOFF) sim += GEO_PENALTY_MILD
    }
    return { ...r, similarity: sim, distance_miles: dist }
  })
  boostedReviews.sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0))

  return {
    reviews: boostedReviews,
    venues: withinCutoff,
    venueDistances,
  }
}
