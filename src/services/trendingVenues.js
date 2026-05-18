import { supabase } from '../lib/supabase'
import { isVenueExcludedFromDiscoverySearch } from '../utils/venueSearch'

/** DB pool size maintained by refresh_venue_trending_ranks (scraper). */
export const TRENDING_RANK_POOL_SIZE = 200

/** Default venues shown in Browse trending. */
export const TRENDING_DISPLAY_LIMIT_DEFAULT = 100

const VENUE_SELECT =
  'venue_id, name, neighborhood_name, primary_photo_url, city, rating10, cuisine_type, compact_summary, review_summary, editorial_summary, latitude, longitude, status, business_status, trending_rank, venue_type(venue_type_name)'

function aggregateMentionsByVenueId(rows) {
  const byVenue = new Map()
  for (const row of rows || []) {
    const vid = row.venue_id
    if (vid == null) continue
    if (!byVenue.has(vid)) {
      byVenue.set(vid, { urls: new Set(), mentions: [] })
    }
    const entry = byVenue.get(vid)
    if (!entry.urls.has(row.source_url)) {
      entry.urls.add(row.source_url)
      entry.mentions.push({
        source_url: row.source_url,
        source_list_name: row.source_list_name || null,
      })
    }
  }
  return byVenue
}

/**
 * Venues in the trending pool (venue.trending_rank), refreshed by food-media scraper.
 * Same behavior as web `src/services/trendingVenues.js`.
 * @param {number} limit
 * @returns {Promise<Array<{ venue, mentionCount, mentions }>>}
 */
export async function getTrendingVenues(limit = TRENDING_DISPLAY_LIMIT_DEFAULT) {
  const { data: rankedVenues, error: venueError } = await supabase
    .from('venue')
    .select(VENUE_SELECT)
    .not('trending_rank', 'is', null)
    .order('trending_rank', { ascending: true })
    .limit(TRENDING_RANK_POOL_SIZE)

  if (venueError) {
    console.error('[trendingVenues] venue fetch', venueError)
    return []
  }

  const openRanked = (rankedVenues || []).filter((v) => !isVenueExcludedFromDiscoverySearch(v))
  const displayVenues = openRanked.slice(0, limit)
  if (displayVenues.length === 0) return []

  const venueIds = displayVenues.map((v) => v.venue_id)

  const { data: mentionRows, error: mentionError } = await supabase
    .from('external_venue_mention')
    .select('venue_id, source_url, source_list_name')
    .in('venue_id', venueIds)

  if (mentionError) {
    console.error('[trendingVenues] mentions', mentionError)
    return displayVenues.map((venue) => ({
      venue,
      mentionCount: 0,
      mentions: [],
    }))
  }

  const mentionsByVenue = aggregateMentionsByVenueId(mentionRows)

  return displayVenues.map((venue) => {
    const entry = mentionsByVenue.get(venue.venue_id)
    return {
      venue,
      mentionCount: entry ? entry.urls.size : 0,
      mentions: entry ? entry.mentions : [],
    }
  })
}
