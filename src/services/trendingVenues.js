import { supabase } from '../lib/supabase'
import { isVenueExcludedFromDiscoverySearch } from '../utils/venueSearch'

/** DB pool size maintained by refresh_venue_trending_ranks (scraper). */
export const TRENDING_RANK_POOL_SIZE = 200

/** Default venues shown in Browse trending. */
export const TRENDING_DISPLAY_LIMIT_DEFAULT = 100

/** Venues created within this many days appear in Browse > Trending > What's New. */
export const NEW_VENUE_WINDOW_DAYS = 60

/** Default venues shown in Browse / What's New. */
export const NEW_VENUE_DISPLAY_LIMIT_DEFAULT = 50

/**
 * ISO timestamp cutoff for What's New (created_at >= cutoff).
 * @param {number} [windowDays]
 * @param {Date} [now]
 */
export function getNewVenueCutoffIso(windowDays = NEW_VENUE_WINDOW_DAYS, now = new Date()) {
  const d = new Date(now.getTime())
  d.setUTCDate(d.getUTCDate() - windowDays)
  return d.toISOString()
}

const VENUE_SELECT =
  'venue_id, name, neighborhood_name, primary_photo_url, city, rating10, cuisine_type, compact_summary, review_summary, editorial_summary, latitude, longitude, status, business_status, exclude_from_discovery, trending_rank, venue_type(venue_type_name)'

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
    .eq('exclude_from_discovery', false)
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

/**
 * Venues created within NEW_VENUE_WINDOW_DAYS for Browse > Trending > What's New.
 * @param {number} limit
 * @returns {Promise<Array<{ venue, mentionCount, mentions }>>}
 */
export async function getNewVenues(limit = NEW_VENUE_DISPLAY_LIMIT_DEFAULT) {
  const cutoffIso = getNewVenueCutoffIso()

  const { data: venues, error: venueError } = await supabase
    .from('venue')
    .select(`${VENUE_SELECT}, created_at, rating_count, google_rating10_count`)
    .gte('created_at', cutoffIso)
    .eq('show_in_whats_new', true)
    .eq('import_review_status', 'approved')
    .eq('exclude_from_discovery', false)
    .order('created_at', { ascending: false })
    .order('rating10', { ascending: false, nullsFirst: false })
    .order('rating_count', { ascending: false, nullsFirst: false })
    .limit(limit)

  if (venueError) {
    console.error('[trendingVenues] new venues fetch', venueError)
    return []
  }

  const eligible = (venues || []).filter((v) => !isVenueExcludedFromDiscoverySearch(v))
  return eligible.map((venue) => ({
    venue,
    mentionCount: 0,
    mentions: [],
  }))
}
