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
 * @param {{ reviewText?: string | null }} [opts]
 * @returns {Promise<{ ok: boolean, skipped?: boolean, reason?: string, review_in_search_text?: boolean }>}
 */
export async function triggerVenueSearchReindex(venueId, opts = {}) {
  const id = venueId != null ? parseInt(String(venueId), 10) : NaN
  if (!Number.isFinite(id) || id <= 0) {
    return { ok: false, reason: 'invalid venue_id' }
  }

  const base = resolveSearchApiBaseUrl(config.searchApiUrl)
  if (!base) {
    console.warn('[triggerVenueSearchReindex] EXPO_PUBLIC_SEARCH_API_URL not set')
    return { ok: false, reason: 'no_search_api_url' }
  }

  const reviewText = (opts.reviewText || '').trim() || null
  const url = `${base}/api/reindex-venue-search`
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        venue_id: id,
        ...(reviewText ? { review_text: reviewText } : {}),
      }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      const msg = json?.error || `HTTP ${res.status}`
      console.warn(`[triggerVenueSearchReindex] venue_id=${id} failed:`, msg)
      return { ok: false, reason: msg }
    }
    const first = Array.isArray(json.results) ? json.results[0] : null
    return { ok: true, review_in_search_text: first?.review_in_search_text }
  } catch (err) {
    console.warn(`[triggerVenueSearchReindex] venue_id=${id} network error:`, err?.message || err)
    return { ok: false, reason: err?.message || 'network_error' }
  }
}
