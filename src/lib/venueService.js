/**
 * Venue service — Supabase venue fetch, search by name.
 */

import { supabase } from './supabase'

export async function searchVenuesByName(query, limit = 20) {
  if (!supabase) return { data: [], error: new Error('Supabase not configured') }

  const q = (query || '').trim()
  if (!q) {
    const { data, error } = await supabase
      .from('venue')
      .select(`
        venue_id,
        name,
        city,
        primary_photo_url,
        neighborhood_name,
        rating10,
        venue_type(venue_type_name),
        state(state_code)
      `)
      .order('rating_count', { ascending: false, nullsFirst: false })
      .limit(limit)
    return { data: data || [], error }
  }

  const { data: rows, error } = await supabase.rpc('get_venues_page', {
    p_page: 1,
    p_page_size: limit,
    p_search: q,
    p_city: null,
    p_state_id: null,
    p_venue_type_id: null,
    p_user_id: null,
    p_favorite_user_id: null,
    p_order_by: 'name_asc',
    p_min_rating10: null,
  })

  if (error) return { data: [], error }
  const first = rows?.[0]
  const raw = first?.data
  const items = Array.isArray(raw) ? raw : raw ? [raw] : []
  return { data: items, error: null }
}

export async function fetchVenueById(venueId) {
  if (!supabase || !venueId) return { data: null, error: null }
  const { data, error } = await supabase
    .from('venue')
    .select(`
      *,
      venue_type(venue_type_id, venue_type_name),
      state(state_id, state_name, state_code)
    `)
    .eq('venue_id', venueId)
    .single()
  return { data, error }
}

export async function fetchVenuesByIds(venueIds) {
  if (!supabase || !venueIds?.length) return { data: [], error: null }
  const ids = [...new Set(venueIds)].slice(0, 50)
  const { data, error } = await supabase
    .from('venue')
    .select(`
      venue_id,
      name,
      city,
      primary_photo_url,
      neighborhood_name,
      rating10,
      venue_type(venue_type_name),
      state(state_code)
    `)
    .in('venue_id', ids)
  return { data: data || [], error }
}
