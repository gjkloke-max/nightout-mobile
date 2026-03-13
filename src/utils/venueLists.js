import { supabase } from '../lib/supabase'

export const SUGGESTED_LIST_NAMES = [
  'Cozy Cafes',
  'Best Cocktails',
  'Date Night',
  "Great Food, Don't Care About Vibe",
  'Best Patios',
  'Birthday Dinner Ideas',
  'Best Brunch Spots',
  'Casual Weeknight Spots',
  'Worth the Hype',
  'Hidden Gems',
]

export async function createList(listName) {
  if (!supabase) return { data: null, error: { message: 'Not configured' } }
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: { message: 'User not authenticated' } }
  const name = (listName || '').trim()
  if (!name) return { data: null, error: { message: 'List name is required' } }
  const { data, error } = await supabase
    .from('venue_list')
    .insert({ user_id: user.id, list_name: name })
    .select()
    .single()
  return { data, error }
}

export async function getUserLists() {
  if (!supabase) return { data: [], error: null }
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: { message: 'User not authenticated' } }
  const { data: lists, error: le } = await supabase
    .from('venue_list')
    .select('list_id, list_name, cover_image_url, created_at, updated_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
  if (le) return { data: null, error: le }
  if (!lists?.length) return { data: [], error: null }
  const listIds = lists.map((l) => l.list_id)
  const { data: items } = await supabase
    .from('venue_list_item')
    .select('list_id, venue_id')
    .in('list_id', listIds)
  const countByList = {}
  const venueIdsByList = {}
  ;(items || []).forEach((item) => {
    countByList[item.list_id] = (countByList[item.list_id] || 0) + 1
    if (!venueIdsByList[item.list_id]) venueIdsByList[item.list_id] = []
    venueIdsByList[item.list_id].push(item.venue_id)
  })
  const venueIds = [...new Set((items || []).map((i) => i.venue_id))]
  const { data: venues } = await supabase
    .from('venue')
    .select('venue_id, name, primary_photo_url')
    .in('venue_id', venueIds)
  const venueMap = new Map((venues || []).map((v) => [v.venue_id, v]))
  const listsWithMeta = lists.map((list) => ({
    ...list,
    item_count: countByList[list.list_id] || 0,
    preview_venues: (venueIdsByList[list.list_id] || [])
      .slice(0, 4)
      .map((vid) => venueMap.get(vid))
      .filter(Boolean),
  }))
  return { data: listsWithMeta, error: null }
}

export async function getListWithItems(listId) {
  if (!supabase) return { data: null, error: { message: 'Not configured' } }
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: { message: 'User not authenticated' } }
  const { data: list, error: le } = await supabase
    .from('venue_list')
    .select('list_id, list_name, cover_image_url, created_at, updated_at')
    .eq('list_id', listId)
    .eq('user_id', user.id)
    .single()
  if (le || !list) return { data: null, error: le || { message: 'List not found' } }
  const { data: items, error: ie } = await supabase
    .from('venue_list_item')
    .select('list_item_id, venue_id, note, sort_order, created_at')
    .eq('list_id', listId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (ie) return { data: null, error: ie }
  const venueIds = (items || []).map((i) => i.venue_id).filter(Boolean)
  if (venueIds.length === 0) return { data: { ...list, items: [] }, error: null }
  const { data: venues, error: ve } = await supabase
    .from('venue')
    .select('venue_id, name, city, primary_photo_url, venue_type(venue_type_name), state(state_code)')
    .in('venue_id', venueIds)
  if (ve) return { data: null, error: ve }
  const venueMap = new Map((venues || []).map((v) => [v.venue_id, v]))
  const itemsWithVenues = (items || []).map((item) => ({
    ...item,
    venue: venueMap.get(item.venue_id) || null,
  })).filter((i) => i.venue)
  return { data: { ...list, items: itemsWithVenues }, error: null }
}

export async function addVenueToList(listId, venueId, note = null) {
  if (!supabase) return { data: null, error: { message: 'Not configured' } }
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: { message: 'User not authenticated' } }
  const { data: list } = await supabase
    .from('venue_list')
    .select('list_id')
    .eq('list_id', listId)
    .eq('user_id', user.id)
    .single()
  if (!list) return { data: null, error: { message: 'List not found' } }
  const { data, error } = await supabase
    .from('venue_list_item')
    .insert({ list_id: listId, venue_id: venueId, note: (note || '').trim() || null })
    .select()
    .single()
  if (error?.code === '23505') return { data: null, error: { message: 'Venue is already in this list' } }
  return { data, error }
}

export async function removeVenueFromList(listItemId) {
  if (!supabase) return { data: null, error: { message: 'Not configured' } }
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: { message: 'User not authenticated' } }
  const { data: item } = await supabase
    .from('venue_list_item')
    .select('list_id')
    .eq('list_item_id', listItemId)
    .single()
  if (!item) return { data: null, error: { message: 'Item not found' } }
  const { data: list } = await supabase
    .from('venue_list')
    .select('list_id')
    .eq('list_id', item.list_id)
    .eq('user_id', user.id)
    .single()
  if (!list) return { data: null, error: { message: 'List not found' } }
  const { error } = await supabase.from('venue_list_item').delete().eq('list_item_id', listItemId)
  return { data: { success: true }, error }
}

export async function getListsForAddModal() {
  if (!supabase) return { data: [], error: null }
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: { message: 'User not authenticated' } }
  const { data, error } = await supabase
    .from('venue_list')
    .select('list_id, list_name')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
  return { data: data || [], error }
}
