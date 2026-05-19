import { config } from './config'

/**
 * @param {number|string} venueId
 * @returns {Promise<string|null>}
 */
export async function fetchVenueSearchText(venueId) {
  const id = venueId != null ? parseInt(String(venueId), 10) : NaN
  if (!Number.isFinite(id) || id <= 0) return null

  const base = (config.searchApiUrl || '').replace(/\/$/, '')
  if (!base) return null

  try {
    const res = await fetch(`${base}/api/venue-search-text/${id}`)
    const json = await res.json().catch(() => ({}))
    if (!res.ok) return null
    const text = typeof json.search_text === 'string' ? json.search_text.trim() : ''
    return text || null
  } catch {
    return null
  }
}
