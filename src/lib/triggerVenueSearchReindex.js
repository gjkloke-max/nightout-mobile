/**
 * Fire-and-forget venue search reindex after user review save (see NightOut server).
 */

import { Platform } from 'react-native'
import { config } from './config'

function resolveSearchApiBaseUrl(url) {
  const trimmed = (url || '').replace(/\/$/, '')
  if (!trimmed || !__DEV__ || Platform.OS !== 'android') return trimmed
  return trimmed.replace(
    /^(https?:\/\/)(127\.0\.0\.1|localhost)(:\d+)?$/i,
    (_, proto, _host, port) => `${proto}10.0.2.2${port ?? ''}`,
  )
}

/**
 * @param {number|string} venueId
 */
export function triggerVenueSearchReindex(venueId) {
  const id = venueId != null ? parseInt(String(venueId), 10) : NaN
  if (!Number.isFinite(id) || id <= 0) return

  const base = resolveSearchApiBaseUrl(config.searchApiUrl)
  if (!base) return

  const url = `${base}/api/reindex-venue-search-background`
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ venue_id: id }),
  }).catch(() => {})
}
