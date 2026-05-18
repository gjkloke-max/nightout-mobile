/**
 * Discovery/search venue filters (aligned with web src/utils/venueSearch.js).
 */

export function isVenueExcludedFromDiscoverySearch(venue) {
  if (!venue) return true
  if (venue.status === 'temporarily_closed') return true
  const bs = String(venue.business_status || '').toUpperCase().trim()
  if (bs === 'CLOSED_TEMPORARILY' || bs === 'CLOSED_PERMANENTLY') return true
  return false
}
