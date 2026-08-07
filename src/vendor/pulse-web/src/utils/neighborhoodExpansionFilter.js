import { getProximityTier } from './neighborhoodAdjacency.js'
import { normalizeVenueNeighborhoodToCommunity } from './detectNeighborhoodIntent.js'
import { isExcludedSuburbName } from './chicagoSuburbExclusions.js'

/**
 * Strict explicit neighborhood: venue must match canonical community area, or have no
 * neighborhood in DB. Suburbs and other non-matching names are excluded (fixes vNorm===null
 * incorrectly including Rosemont, Park Ridge, etc.).
 */
export function isVenueInStrictNeighborhoodMatch(rawNeighborhood, requestedNeighborhood) {
  if (!requestedNeighborhood) return true
  const raw = (rawNeighborhood || '').trim()
  if (isExcludedSuburbName(raw)) return false
  const vNorm = normalizeVenueNeighborhoodToCommunity(rawNeighborhood)
  if (vNorm === requestedNeighborhood) return true
  if (!raw) return true
  return false
}

/**
 * After server expanded citywide: keep venues in anchor (tier 1) or any curated nearby neighbor (tier 2).
 * Tier 4 = outside the curated set. CSV rank is not used at runtime.
 *
 * @param {string|null|undefined} rawNeighborhood
 * @param {string|null} requestedNeighborhood
 * @param {number} maxProximityTier — cap for tier filter (default 3 includes tier 1–2)
 */
export function isVenueInExpandedNeighborhoodScope(
  rawNeighborhood,
  requestedNeighborhood,
  maxProximityTier = 3,
) {
  if (!requestedNeighborhood) return true
  const raw = (rawNeighborhood || '').trim()
  if (!raw) return true
  if (isExcludedSuburbName(raw)) return false
  const { tier } = getProximityTier(rawNeighborhood, requestedNeighborhood, normalizeVenueNeighborhoodToCommunity)
  const cap =
    typeof maxProximityTier === 'number' && maxProximityTier >= 1 ? Math.floor(maxProximityTier) : 3
  return tier <= Math.min(cap, 4)
}
