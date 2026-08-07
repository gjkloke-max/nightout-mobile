/**
 * Bridge location detection → hybrid search anchor (neighborhood_tag vs micro_neighborhood).
 */

import { detectLocationIntent, primaryLocationAnchorType } from './detectLocationIntent.js'
import { detectNeighborhoodIntent } from './detectNeighborhoodIntent.js'
import { getBroadRegionNeighborhoodAllowlistFromAnchor } from './broadRegionStore.js'
import { detectGenericCityScope, stripGenericCityScopeFromQuery } from './genericCityToken.js'
import { getExpandedNeighborhoods, getProximityTier } from './neighborhoodAdjacency.js'
import {
  getExpandedMicroNeighborhoods,
  getMicroProximityTier,
  resolveMicroNeighborhoodKey,
} from './microNeighborhoodNearbyStore.js'
import { isVenueInExpandedNeighborhoodScope, isVenueInStrictNeighborhoodMatch } from './neighborhoodExpansionFilter.js'
import { normalizeVenueNeighborhoodToCommunity } from './detectNeighborhoodIntent.js'
import { toDisplayLocationName } from './locationRegistry.js'

/** @typedef {'neighborhood_tag'|'micro_neighborhood'|'broad_region'|'city_scope'} LocationAnchorType */

/**
 * @typedef {{
 *   type: LocationAnchorType,
 *   name: string,
 *   displayName: string,
 *   slug?: string|null,
 *   neighborhoods?: string[],
 *   locationIntent?: string|null,
 *   queryWithoutLocation?: string,
 *   raw?: ReturnType<typeof detectLocationIntent>,
 * }} LocationSearchAnchor
 */

function buildBroadRegionAnchor(loc) {
  const region = loc.broad_region
  const neighborhoods = getBroadRegionNeighborhoodAllowlistFromAnchor({
    type: 'broad_region',
    name: region.slug || region.name,
    neighborhoods: region.neighborhoods,
  })
  return {
    type: 'broad_region',
    name: region.slug || region.name,
    displayName: loc.normalized_location || region.name,
    slug: region.slug,
    neighborhoods,
    locationIntent: loc.location_intent,
    queryWithoutLocation: loc.query_without_location,
    raw: loc,
  }
}

function buildBroadRegionAnchorFromPayload(payloadHint) {
  const neighborhoods = getBroadRegionNeighborhoodAllowlistFromAnchor(payloadHint)
  return {
    type: 'broad_region',
    name: String(payloadHint.name),
    displayName: payloadHint.displayName ? String(payloadHint.displayName) : String(payloadHint.name),
    slug: payloadHint.slug ? String(payloadHint.slug) : null,
    neighborhoods,
    locationIntent: payloadHint.locationIntent ?? null,
    queryWithoutLocation: payloadHint.queryWithoutLocation ?? null,
  }
}

/**
 * @param {string} queryText
 * @param {string|import('./locationSearchAnchor.js').LocationSearchAnchor|null} [payloadHint]
 * @returns {LocationSearchAnchor|null}
 */
export function resolveLocationSearchAnchor(queryText, payloadHint = null) {
  const loc = detectLocationIntent(queryText || '')
  if (loc.anchor_types?.includes('city_scope')) {
    return null
  }
  if (loc.location_mentioned) {
    const type = primaryLocationAnchorType(loc)
    if (type === 'neighborhood_tag') {
      return {
        type,
        name: loc.neighborhood_canonical,
        displayName: loc.normalized_location || toDisplayLocationName(loc.neighborhood_canonical),
        locationIntent: loc.location_intent,
        queryWithoutLocation: loc.query_without_location,
        raw: loc,
      }
    }
    if (type === 'broad_region' && loc.broad_region) {
      return buildBroadRegionAnchor(loc)
    }
    return {
      type: 'micro_neighborhood',
      name: loc.micro_neighborhood.name,
      slug: loc.micro_neighborhood.slug,
      displayName: loc.normalized_location || loc.micro_neighborhood.name,
      locationIntent: loc.location_intent,
      queryWithoutLocation: loc.query_without_location,
      raw: loc,
    }
  }

  if (payloadHint && typeof payloadHint === 'object' && payloadHint.type && payloadHint.name) {
    if (payloadHint.type === 'broad_region') {
      return buildBroadRegionAnchorFromPayload(payloadHint)
    }
    return {
      type: payloadHint.type,
      name: String(payloadHint.name),
      displayName: payloadHint.displayName
        ? String(payloadHint.displayName)
        : toDisplayLocationName(String(payloadHint.name)),
      slug: payloadHint.slug ? String(payloadHint.slug) : null,
      locationIntent: payloadHint.locationIntent ?? null,
      queryWithoutLocation: payloadHint.queryWithoutLocation ?? null,
    }
  }

  const payload = typeof payloadHint === 'string' ? payloadHint.trim() : ''
  if (payload) {
    const fromPayload = detectLocationIntent(`in ${payload}`)
    if (fromPayload.location_mentioned) {
      const type = primaryLocationAnchorType(fromPayload)
      if (type === 'neighborhood_tag') {
        return {
          type,
          name: fromPayload.neighborhood_canonical,
          displayName: fromPayload.normalized_location || toDisplayLocationName(fromPayload.neighborhood_canonical),
          locationIntent: fromPayload.location_intent,
          queryWithoutLocation: fromPayload.query_without_location,
          raw: fromPayload,
        }
      }
      if (type === 'broad_region' && fromPayload.broad_region) {
        return buildBroadRegionAnchor(fromPayload)
      }
      if (fromPayload.micro_neighborhood) {
        return {
          type: 'micro_neighborhood',
          name: fromPayload.micro_neighborhood.name,
          slug: fromPayload.micro_neighborhood.slug,
          displayName:
            fromPayload.normalized_location || fromPayload.micro_neighborhood.name,
          locationIntent: fromPayload.location_intent,
          queryWithoutLocation: fromPayload.query_without_location,
          raw: fromPayload,
        }
      }
    }
    return {
      type: 'neighborhood_tag',
      name: payload,
      displayName: toDisplayLocationName(payload),
    }
  }

  return null
}

/**
 * BM25/embed/rerank intent text: never inherit payload-only location anchor residue
 * (e.g. query_text "cookie" + effective_neighborhood must stay "cookie", not "in LINCOLN PARK").
 * @param {string} queryText
 * @param {LocationSearchAnchor|null} locationAnchorExplicit
 */
export function resolveHybridIntentQueryText(queryText, locationAnchorExplicit = null) {
  const q = (queryText || '').trim()
  const cityScope = detectGenericCityScope(q)
  if (cityScope && !locationAnchorExplicit) {
    return stripGenericCityScopeFromQuery(q) || q
  }
  const fromQuery = detectNeighborhoodIntent(q)
  if (fromQuery.detected) {
    return (fromQuery.queryWithoutNeighborhood || q).trim() || q
  }
  if (cityScope) {
    return stripGenericCityScopeFromQuery(q) || q
  }
  if (locationAnchorExplicit?.queryWithoutLocation) {
    return locationAnchorExplicit.queryWithoutLocation.trim() || q
  }
  const loc = detectLocationIntent(q)
  if (loc.location_mentioned && loc.query_without_location) {
    return loc.query_without_location.trim() || q
  }
  return q
}

/** @returns {string|null} city scope display name when query uses standalone city token only. */
export function resolveCityScopeFromQuery(queryText) {
  return detectGenericCityScope(queryText)?.displayName ?? null
}

/**
 * Legacy neighborhood-only detection when full location anchor is not needed.
 * @param {string} queryText
 */
export function resolveNeighborhoodExplicitFromQuery(queryText) {
  const anchor = resolveLocationSearchAnchor(queryText)
  if (anchor?.type === 'neighborhood_tag') return anchor.name
  return detectNeighborhoodIntent(queryText).detected
}

/** @param {LocationSearchAnchor|null} anchor */
export function hybridSqlNeighborhoodFilter(anchor) {
  if (!anchor || anchor.type !== 'neighborhood_tag') return null
  return anchor.name
}

/** @param {LocationSearchAnchor|null} anchor */
export function geographicAnchorName(anchor) {
  return anchor?.name ?? null
}

/** @param {LocationSearchAnchor|null} anchor */
export function getExpandedLocationAllowlist(anchor) {
  if (!anchor) return []
  if (anchor.type === 'venue_radius') return []
  if (anchor.type === 'broad_region') {
    return getBroadRegionNeighborhoodAllowlistFromAnchor(anchor)
  }
  if (anchor.type === 'micro_neighborhood') {
    return getExpandedMicroNeighborhoods(anchor.name)
  }
  return getExpandedNeighborhoods(anchor.name).map((n) => String(n).toUpperCase().replace(/\s+/g, ' '))
}

/** @param {LocationAnchorType} anchorType */
export function venueLocationSqlColumn(anchorType) {
  if (anchorType === 'micro_neighborhood') return 'micro_neighborhood_name'
  return 'neighborhood_name'
}

/** @param {LocationAnchorType} anchorType */
export function pickVenueLocationFromMetadata(metadata, anchorType, anchor = null) {
  if (!metadata) return ''
  if (anchorType === 'micro_neighborhood') {
    const names = normalizeVenueMicroNames(metadata)
    if (anchor && names.length) {
      const best = bestMicroProximityTierForVenue(names, anchor)
      return best.displayName || best.canonical || names[0] || ''
    }
    return metadata.micro_neighborhood_name || names[0] || ''
  }
  return metadata.neighborhood_name || ''
}

/** @param {{ micro_neighborhood_name?: string, micro_neighborhood_names?: string[] }} metadata */
export function normalizeVenueMicroNames(metadata) {
  if (!metadata) return []
  if (Array.isArray(metadata.micro_neighborhood_names) && metadata.micro_neighborhood_names.length) {
    return metadata.micro_neighborhood_names.map((n) => String(n || '').trim()).filter(Boolean)
  }
  const single = metadata.micro_neighborhood_name
  return single && String(single).trim() ? [String(single).trim()] : []
}

/** @param {string[]} microNames @param {LocationSearchAnchor|null} anchor */
export function bestMicroProximityTierForVenue(microNames, anchor) {
  const names = Array.isArray(microNames) ? microNames.filter(Boolean) : []
  if (!names.length || !anchor) return { tier: 4, canonical: '', displayName: '' }
  let best = { tier: 4, canonical: '', displayName: '' }
  for (const name of names) {
    const t = proximityTierForLocationAnchor(name, anchor)
    if (t.tier < best.tier) best = t
  }
  return best
}

/** @param {string[]} microNames @param {LocationSearchAnchor|null} anchor */
export function isVenueMicroInExpandedLocationScope(microNames, anchor, maxProximityTier = 3) {
  if (!anchor || anchor.type !== 'micro_neighborhood') return true
  const names = Array.isArray(microNames) ? microNames.filter(Boolean) : []
  if (!names.length) return true
  return names.some((name) => isVenueInExpandedLocationScope(name, anchor, maxProximityTier))
}

/** @param {string[]} microNames @param {LocationSearchAnchor|null} anchor */
export function isVenueMicroInStrictLocationMatch(microNames, anchor) {
  if (!anchor || anchor.type !== 'micro_neighborhood') return true
  const names = Array.isArray(microNames) ? microNames.filter(Boolean) : []
  if (!names.length) return true
  return names.some((name) => isVenueInStrictLocationMatch(name, anchor))
}

/**
 * @param {Record<string, { neighborhood_name?: string, micro_neighborhood_name?: string, micro_neighborhood_names?: string[] }>} metadataById
 * @param {LocationAnchorType} anchorType
 * @param {LocationSearchAnchor|null} [anchor]
 */
export function buildVenueLocationMap(metadataById, anchorType, anchor = null) {
  const out = {}
  for (const [vid, m] of Object.entries(metadataById || {})) {
    const v = pickVenueLocationFromMetadata(m, anchorType, anchor)
    if (v) out[parseInt(vid, 10)] = v
  }
  return out
}

/**
 * @param {string} venueLocationValue
 * @param {LocationSearchAnchor|null} anchor
 */
export function proximityTierForLocationAnchor(venueLocationValue, anchor) {
  if (!anchor) return { tier: 4, canonical: '', displayName: '' }
  if (anchor.type === 'venue_radius') {
    return {
      tier: 1,
      canonical: String(venueLocationValue || '').trim().toUpperCase().replace(/\s+/g, ' '),
      displayName: String(venueLocationValue || '').trim(),
    }
  }
  if (anchor.type === 'broad_region') {
    const allowlist = getBroadRegionNeighborhoodAllowlistFromAnchor(anchor)
    const inRegion = allowlist.some((key) =>
      venueMatchesLocationKey(venueLocationValue, key, 'neighborhood_tag'),
    )
    if (inRegion) {
      return {
        tier: 1,
        canonical: String(venueLocationValue || '').trim().toUpperCase().replace(/\s+/g, ' '),
        displayName: String(venueLocationValue || '').trim(),
      }
    }
    return { tier: 4, canonical: '', displayName: '' }
  }
  if (anchor.type === 'micro_neighborhood') {
    return getMicroProximityTier(venueLocationValue, anchor.name)
  }
  return getProximityTier(venueLocationValue, anchor.name, normalizeVenueNeighborhoodToCommunity)
}

/** @param {LocationSearchAnchor|null} anchor */
export function proximityTierFnForAnchor(anchor) {
  if (!anchor) return null
  return (raw, _req) => proximityTierForLocationAnchor(raw, anchor)
}

/** @param {LocationSearchAnchor|null} anchor */
export function isStrictLocationIntent(anchor, queryText) {
  if (anchor?.locationIntent === 'exact_only') return true
  return anchor?.raw?.location_intent === 'exact_only'
}

/** @param {LocationSearchAnchor|null} anchor */
export function locationAnchorLogLabel(anchor) {
  if (!anchor) return null
  if (anchor.type === 'venue_radius') {
    return `venue_radius:${anchor.venueName || anchor.venueId || `${anchor.lat},${anchor.lng}`} (${anchor.radiusMiles}mi)`
  }
  return `${anchor.type}:${anchor.displayName || anchor.name}`
}

/** @param {LocationSearchAnchor|null} anchor */
export function isVenueInExpandedLocationScope(rawLocationValue, anchor, maxProximityTier = 3) {
  if (!anchor) return true
  if (anchor.type === 'broad_region') {
    return isVenueInStrictLocationMatch(rawLocationValue, anchor)
  }
  if (anchor.type === 'micro_neighborhood') {
    const raw = (rawLocationValue || '').trim()
    if (!raw) return true
    const { tier } = getMicroProximityTier(raw, anchor.name)
    const cap =
      typeof maxProximityTier === 'number' && maxProximityTier >= 1 ? Math.floor(maxProximityTier) : 3
    return tier <= Math.min(cap, 4)
  }
  return isVenueInExpandedNeighborhoodScope(rawLocationValue, anchor.name, maxProximityTier)
}

/** @param {LocationSearchAnchor|null} anchor */
export function isVenueInStrictLocationMatch(rawLocationValue, anchor) {
  if (!anchor) return true
  if (anchor.type === 'broad_region') {
    const allowlist = getBroadRegionNeighborhoodAllowlistFromAnchor(anchor)
    return allowlist.some((key) => venueMatchesLocationKey(rawLocationValue, key, 'neighborhood_tag'))
  }
  if (anchor.type === 'micro_neighborhood') {
    return proximityTierForLocationAnchor(rawLocationValue, anchor).tier === 1
  }
  return isVenueInStrictNeighborhoodMatch(rawLocationValue, anchor.name)
}

/**
 * @param {object|null|undefined} body
 * @returns {LocationSearchAnchor|null}
 */
export function parseLocationAnchorFromSearchRequest(body) {
  if (!body || typeof body !== 'object') return null
  const la = body.location_anchor
  if (!la || typeof la !== 'object' || !la.type) return null
  if (la.type === 'venue_radius') {
    const lat = parseFloat(la.lat)
    const lng = parseFloat(la.lng)
    const radiusMiles = parseFloat(la.radiusMiles)
    if (isNaN(lat) || isNaN(lng) || isNaN(radiusMiles) || radiusMiles <= 0) return null
    return {
      type: 'venue_radius',
      lat,
      lng,
      radiusMiles,
      ...(la.venueId != null ? { venueId: la.venueId } : {}),
      ...(la.venueName ? { venueName: String(la.venueName) } : {}),
    }
  }
  if (!la.name) return null
  return resolveLocationSearchAnchor('', la)
}

/** @param {Record<string, { neighborhood_name?: string, micro_neighborhood_name?: string, micro_neighborhood_names?: string[] }>} metadataById */
export function buildVenueLocationMapFromMetadata(metadataById, anchorType, anchor = null) {
  return buildVenueLocationMap(metadataById, anchorType || 'neighborhood_tag', anchor)
}

/** Compare venue location to anchor allowlist keys (case-insensitive). */
export function venueMatchesLocationKey(venueLocationValue, locationKey, anchorType) {
  const v =
    anchorType === 'micro_neighborhood'
      ? resolveMicroNeighborhoodKey(venueLocationValue)
      : String(venueLocationValue || '')
          .trim()
          .toUpperCase()
          .replace(/\s+/g, ' ')
  const k =
    anchorType === 'micro_neighborhood'
      ? resolveMicroNeighborhoodKey(locationKey)
      : String(locationKey || '')
          .trim()
          .toUpperCase()
          .replace(/\s+/g, ' ')
  return v === k
}

/**
 * Best area label for LLM / debug when location-scoped (prefers micro under micro anchor).
 * @param {Record<string, unknown>|null|undefined} venue
 * @param {LocationSearchAnchor|null} anchor
 */
export function venueAreaLabelForLocationAnchor(venue, anchor) {
  if (anchor?.type === 'micro_neighborhood') {
    const names = normalizeVenueMicroNames(venue)
    if (names.length) {
      const best = bestMicroProximityTierForVenue(names, anchor)
      return best.displayName || names[0]
    }
  }
  const nh = venue?.neighborhood_name
  return nh != null && String(nh).trim() ? String(nh).trim() : null
}

/**
 * True when venue is outside tier-1 match for the requested location anchor.
 * @param {Record<string, unknown>|null|undefined} venue
 * @param {LocationSearchAnchor|null} anchor
 */
export function isVenueOutsideRequestedLocation(venue, anchor) {
  if (!anchor || !venue) return false
  if (anchor.type === 'broad_region') {
    const raw = venue?.neighborhood_name || ''
    return !isVenueInStrictLocationMatch(raw, anchor)
  }
  if (anchor.type === 'micro_neighborhood') {
    const names = normalizeVenueMicroNames(venue)
    if (!names.length) return true
    return !isVenueMicroInStrictLocationMatch(names, anchor)
  }
  const raw = venue?.neighborhood_name || ''
  return !isVenueInStrictNeighborhoodMatch(raw, anchor.name)
}
