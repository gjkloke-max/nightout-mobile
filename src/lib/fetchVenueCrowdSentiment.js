import { supabase } from './supabase'

/**
 * Load precomputed crowd sentiment tags for a venue (venue_crowd_sentiment).
 * @param {number|string} venueId
 * @returns {Promise<string[]>}
 */
export async function fetchVenueCrowdSentimentTags(venueId) {
  const id = venueId != null ? parseInt(String(venueId), 10) : NaN
  if (!Number.isFinite(id) || id <= 0 || !supabase) return []

  const { data, error } = await supabase
    .from('venue_crowd_sentiment')
    .select('tag_label, display_order')
    .eq('venue_id', id)
    .order('display_order', { ascending: true })

  if (error || !data?.length) return []
  return data.map((row) => String(row.tag_label || '').trim()).filter(Boolean)
}
