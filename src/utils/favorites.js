import { supabase } from '../lib/supabase'

export async function addFavorite(venueId) {
  if (!supabase) return { data: null, error: { message: 'Not configured' } }
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: { message: 'User not authenticated' } }
  const { data, error } = await supabase
    .from('user_favorite_venue')
    .insert({ user_id: user.id, venue_id: venueId })
    .select()
    .single()
  return { data, error }
}

export async function removeFavorite(venueId) {
  if (!supabase) return { data: null, error: { message: 'Not configured' } }
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: { message: 'User not authenticated' } }
  const { data, error } = await supabase
    .from('user_favorite_venue')
    .delete()
    .eq('user_id', user.id)
    .eq('venue_id', venueId)
    .select()
    .single()
  return { data, error }
}

export async function getFavoriteVenueIds() {
  if (!supabase) return []
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data, error } = await supabase
    .from('user_favorite_venue')
    .select('venue_id')
    .eq('user_id', user.id)
  if (error) return []
  return (data || []).map((f) => f.venue_id)
}

export async function getUserFavorites() {
  if (!supabase) return { data: null, error: { message: 'Not configured' } }
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: { message: 'User not authenticated' } }
  const { data: favorites, error: fe } = await supabase
    .from('user_favorite_venue')
    .select('favorite_id, created_at, venue_id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
  if (fe || !favorites?.length) return { data: fe ? null : [], error: fe }
  const venueIds = favorites.map((f) => f.venue_id)
  const { data: venues, error: ve } = await supabase
    .from('venue')
    .select(`
      venue_id, name, city, primary_photo_url, neighborhood_name, rating10,
      venue_type(venue_type_name),
      state(state_code)
    `)
    .in('venue_id', venueIds)
  if (ve) return { data: null, error: ve }
  const venueMap = new Map((venues || []).map((v) => [v.venue_id, v]))
  return {
    data: favorites
      .map((f) => ({ ...f, venue: venueMap.get(f.venue_id) }))
      .filter((f) => f.venue),
    error: null,
  }
}
