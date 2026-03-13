import { supabase } from '../lib/supabase'

export async function getUserTopTenEligibility(userId) {
  if (!userId || !supabase) return { total_reviewed_count: 0, has_unlocked_top_ten: false }
  const { count, error } = await supabase
    .from('venue_review')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .not('rating10', 'is', null)
  if (error) return { total_reviewed_count: 0, has_unlocked_top_ten: false }
  const total = count ?? 0
  return { total_reviewed_count: total, has_unlocked_top_ten: total >= 10 }
}

export async function getUserTopTenVenues(userId) {
  if (!userId || !supabase) return []
  const { data: reviews, error } = await supabase
    .from('venue_review')
    .select(`
      venue_review_id, venue_id, rating10, created_at,
      venue:venue_id (venue_id, name, neighborhood_name, primary_photo_url, venue_type(venue_type_name))
    `)
    .eq('user_id', userId)
    .not('rating10', 'is', null)
  if (error) return []
  const withVenue = (reviews || [])
    .map((r) => {
      const v = Array.isArray(r.venue) ? r.venue[0] : r.venue
      return { ...r, venue: v }
    })
    .filter((r) => r.venue)
  withVenue.sort((a, b) => {
    const scoreA = Number(a.rating10) || 0
    const scoreB = Number(b.rating10) || 0
    if (scoreB !== scoreA) return scoreB - scoreA
    return new Date(b.created_at) - new Date(a.created_at)
  })
  return withVenue.slice(0, 10).map((r, i) => ({
    rank: i + 1,
    venue_id: r.venue_id,
    venue_name: r.venue?.name,
    neighborhood_name: r.venue?.neighborhood_name,
    user_score: Number(r.rating10),
    primary_photo_url: r.venue?.primary_photo_url,
    venue: r.venue,
  }))
}
