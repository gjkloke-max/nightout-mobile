import { normalizeVenueId } from './ids.js'

/**
 * @param {Array<{ role: string, venues?: Array }>} messages
 * @param {Iterable<number|null|undefined>} [extraIds]
 * @returns {number[]}
 */
export function collectIntroducedVenueIds(messages, extraIds = []) {
  const out = new Set()
  for (const m of messages || []) {
    if (m.role !== 'assistant' || !Array.isArray(m.venues)) continue
    for (const v of m.venues) {
      const id = normalizeVenueId(v?.venue_id ?? v?.venueId)
      if (id != null) out.add(id)
    }
  }
  for (const id of extraIds) {
    const n = normalizeVenueId(id)
    if (n != null) out.add(n)
  }
  return [...out]
}

/**
 * @param {Array<{ venue_id?: unknown, venueId?: unknown }>} apiVenues
 * @param {Array<{ venue_id?: unknown }>} reviews
 */
export function collectRetrievalPoolVenueIds(apiVenues = [], reviews = []) {
  const out = new Set()
  for (const v of apiVenues) {
    const id = normalizeVenueId(v?.venue_id ?? v?.venueId)
    if (id != null) out.add(id)
  }
  for (const r of reviews) {
    const id = normalizeVenueId(r?.venue_id)
    if (id != null) out.add(id)
  }
  return [...out]
}
