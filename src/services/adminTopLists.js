/**
 * Public read of admin-curated "Top Lists" for Browse > Top Lists.
 * Same shape as web `src/services/adminTopLists.js`.
 */

import { supabase } from '../lib/supabase'
import { isVenueExcludedFromDiscoverySearch } from '../utils/venueSearch'

const VENUE_SELECT =
  'venue_id, name, neighborhood_name, primary_photo_url, city, rating10, cuisine_type, compact_summary, review_summary, editorial_summary, latitude, longitude, status, business_status, exclude_from_discovery, venue_type(venue_type_name)'

/**
 * Published admin top lists, in admin-defined order, with a preview of their venues (for a
 * collapsed list-card view - see getPublishedTopListWithVenues for the full detail fetch).
 * @returns {Promise<Array<{ top_list_id: number, title: string, subtitle: string|null, item_count: number, preview_venues: object[] }>>}
 */
export async function getPublishedTopListSections() {
  const { data: lists, error: listsError } = await supabase
    .from('admin_top_list')
    .select('top_list_id, title, subtitle, display_order')
    .eq('is_published', true)
    .order('display_order', { ascending: true })

  if (listsError) {
    console.error('[adminTopLists] list fetch', listsError)
    return []
  }
  if (!lists?.length) return []

  const listIds = lists.map((l) => l.top_list_id)
  const { data: items, error: itemsError } = await supabase
    .from('admin_top_list_item')
    .select('top_list_id, venue_id, sort_order')
    .in('top_list_id', listIds)
    .order('sort_order', { ascending: true })

  if (itemsError) {
    console.error('[adminTopLists] item fetch', itemsError)
    return []
  }
  if (!items?.length) return []

  const venueIds = [...new Set(items.map((i) => i.venue_id))]
  const { data: venues, error: venuesError } = await supabase.from('venue').select(VENUE_SELECT).in('venue_id', venueIds)

  if (venuesError) {
    console.error('[adminTopLists] venue fetch', venuesError)
    return []
  }

  const venueMap = new Map(
    (venues || []).filter((v) => !isVenueExcludedFromDiscoverySearch(v)).map((v) => [v.venue_id, v])
  )

  const venuesByList = new Map()
  for (const item of items) {
    const venue = venueMap.get(item.venue_id)
    if (!venue) continue
    if (!venuesByList.has(item.top_list_id)) venuesByList.set(item.top_list_id, [])
    venuesByList.get(item.top_list_id).push(venue)
  }

  return lists
    .map((list) => {
      const venues = venuesByList.get(list.top_list_id) || []
      return {
        top_list_id: list.top_list_id,
        title: list.title,
        subtitle: list.subtitle,
        item_count: venues.length,
        preview_venues: venues.slice(0, 4),
      }
    })
    .filter((section) => section.item_count > 0)
}

/**
 * One published admin top list with all its venues, in curator order (for the detail screen).
 * @param {number} topListId
 * @returns {Promise<{ top_list_id: number, title: string, subtitle: string|null, venues: object[] } | null>}
 */
export async function getPublishedTopListWithVenues(topListId) {
  const { data: list, error: listError } = await supabase
    .from('admin_top_list')
    .select('top_list_id, title, subtitle')
    .eq('top_list_id', topListId)
    .eq('is_published', true)
    .maybeSingle()

  if (listError || !list) return null

  const { data: items, error: itemsError } = await supabase
    .from('admin_top_list_item')
    .select('venue_id, sort_order')
    .eq('top_list_id', topListId)
    .order('sort_order', { ascending: true })

  if (itemsError || !items?.length) return { ...list, venues: [] }

  const venueIds = items.map((i) => i.venue_id)
  const { data: venues, error: venuesError } = await supabase.from('venue').select(VENUE_SELECT).in('venue_id', venueIds)
  if (venuesError) return { ...list, venues: [] }

  const venueMap = new Map(
    (venues || []).filter((v) => !isVenueExcludedFromDiscoverySearch(v)).map((v) => [v.venue_id, v])
  )

  return { ...list, venues: items.map((i) => venueMap.get(i.venue_id)).filter(Boolean) }
}
