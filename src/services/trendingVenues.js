import { supabase } from '../lib/supabase'

/**
 * Venues with the most distinct article mentions (external_venue_mention).
 * Same logic as web `src/services/trendingVenues.js` / What's Hot.
 * @param {number} limit
 * @returns {Promise<Array<{ venue, mentionCount, mentions }>>}
 */
export async function getTrendingVenues(limit = 15) {
  const { data: rows, error } = await supabase
    .from('external_venue_mention')
    .select('venue_id, source_url, source_list_name')
    .not('venue_id', 'is', null)

  if (error) {
    console.error('[trendingVenues]', error)
    return []
  }

  const byVenue = new Map()
  for (const row of rows || []) {
    const vid = row.venue_id
    if (!byVenue.has(vid)) {
      byVenue.set(vid, { venueId: vid, urls: new Set(), mentions: [] })
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

  const sorted = [...byVenue.entries()]
    .map(([, v]) => ({
      venueId: v.venueId,
      mentionCount: v.urls.size,
      mentions: v.mentions,
    }))
    .sort((a, b) => b.mentionCount - a.mentionCount)
    .slice(0, limit)

  const venueIds = sorted.map((s) => s.venueId)
  if (venueIds.length === 0) return []

  const { data: venues, error: venueError } = await supabase
    .from('venue')
    .select('venue_id, name, neighborhood_name, primary_photo_url, city, rating10, venue_type(venue_type_name)')
    .in('venue_id', venueIds)

  if (venueError) {
    console.error('[trendingVenues] venue fetch', venueError)
    return []
  }

  const venueMap = new Map((venues || []).map((v) => [v.venue_id, v]))

  return sorted.map((s) => ({
    venue: venueMap.get(s.venueId) || { venue_id: s.venueId, name: 'Unknown' },
    mentionCount: s.mentionCount,
    mentions: s.mentions,
  }))
}
