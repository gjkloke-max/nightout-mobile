/**
 * Browse "For You" — home neighborhood + preferences via hybrid search (Smart Search API).
 */

import { hybridSearch } from '../lib/searchApi'
import { fetchVenuesByIds } from '../lib/venueService'

export const FOR_YOU_RESULT_LIMIT = 20

function venueIdKey(id) {
  const n = parseInt(String(id), 10)
  return Number.isNaN(n) ? null : n
}

function dedupeByVenueId(rows) {
  const seen = new Set()
  return (rows || []).filter((r) => {
    const id = r?.venue_id
    if (!id || seen.has(id)) return false
    seen.add(id)
    return true
  })
}

function mergeVenueDetails(apiRows, supabaseVenues) {
  const byId = new Map()
  ;(supabaseVenues || []).forEach((v) => {
    const k = venueIdKey(v.venue_id)
    if (k != null) byId.set(k, v)
  })
  return (apiRows || []).map((r) => {
    const k = venueIdKey(r.venue_id)
    const details = (k != null ? byId.get(k) : null) || {}
    return {
      venue_id: r.venue_id,
      name: r.name || details.name || 'Unknown',
      primary_photo_url: details.primary_photo_url ?? r.primary_photo_url ?? null,
      neighborhood_name: r.neighborhood_name ?? details.neighborhood_name,
      rating10: r.rating10 ?? details.rating10,
      venue_type: details.venue_type,
      city: details.city,
      cuisine_type: details.cuisine_type ?? null,
      compact_summary: details.compact_summary ?? null,
      review_summary: details.review_summary ?? null,
      editorial_summary: details.editorial_summary ?? null,
      latitude: details.latitude ?? r.latitude,
      longitude: details.longitude ?? r.longitude,
      trending_rank: r.trending_rank ?? details.trending_rank ?? null,
    }
  })
}

export function buildForYouSearchQuery(homeNeighborhoodName) {
  const nh = (homeNeighborhoodName || '').trim()
  if (nh) return `where should I go in ${nh}`
  return 'restaurants in Chicago'
}

export async function getBrowseForYouVenues({
  homeNeighborhoodName = null,
  userPreferences = null,
  limit = FOR_YOU_RESULT_LIMIT,
} = {}) {
  const hasPrefs =
    userPreferences &&
    (userPreferences.foodStyles?.length ||
      userPreferences.ambience?.length ||
      userPreferences.allergies?.length ||
      userPreferences.dislikes?.length)

  if (!hasPrefs) {
    return { items: [], error: null, locked: true }
  }

  const queryText = buildForYouSearchQuery(homeNeighborhoodName)
  const effectiveNeighborhood = (homeNeighborhoodName || '').trim() || null

  const { data: apiRows, error: apiErr } = await hybridSearch({
    queryText,
    queryEmbedding: null,
    matchCount: limit,
    userPreferences,
    effectiveNeighborhood,
  })

  if (apiErr) {
    return { items: [], error: apiErr.message || 'Failed to load recommendations', locked: false }
  }

  if (!apiRows?.length) {
    return { items: [], error: null, locked: false }
  }

  const deduped = dedupeByVenueId(apiRows).slice(0, limit)
  const venueIds = deduped.map((r) => r.venue_id).filter(Boolean)
  const { data: supabaseVenues } = await fetchVenuesByIds(venueIds)
  const merged = mergeVenueDetails(deduped, supabaseVenues)

  const items = merged.map((venue) => ({
    venue,
    mentionCount: 0,
    mentions: [],
  }))

  return { items, error: null, locked: false }
}
