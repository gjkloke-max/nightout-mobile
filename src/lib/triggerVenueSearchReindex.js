/**
 * Refresh ParadeDB venue_search_data after a user review save (see NightOut server).
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
 * @returns {Promise<{ ok: boolean, skipped?: boolean, reason?: string }>}
 */
export async function triggerVenueSearchReindex(venueId) {
  const id = venueId != null ? parseInt(String(venueId), 10) : NaN
  if (!Number.isFinite(id) || id <= 0) {
    return { ok: false, reason: 'invalid venue_id' }
  }

  const base = resolveSearchApiBaseUrl(config.searchApiUrl)
  if (!base) {
    if (__DEV__) {
      console.warn('[triggerVenueSearchReindex] EXPO_PUBLIC_SEARCH_API_URL not set')
    }
    return { ok: false, reason: 'no_search_api_url' }
  }

  const url = `${base}/api/reindex-venue-search-background`
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ venue_id: id }),
    })
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}))
      const msg = errBody?.error || `HTTP ${res.status}`
      if (__DEV__) {
        console.warn(`[triggerVenueSearchReindex] venue_id=${id} failed:`, msg)
      }
      return { ok: false, reason: msg }
    }
    return { ok: true }
  } catch (err) {
    if (__DEV__) {
      console.warn(`[triggerVenueSearchReindex] venue_id=${id} network error:`, err?.message || err)
    }
    return { ok: false, reason: err?.message || 'network_error' }
  }
}
