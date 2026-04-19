/**
 * Geocode home address + resolve neighborhood polygon via Supabase RPC.
 */
import { supabase } from '../lib/supabase'
import { geocodeAddress } from './geocoding'

export const LOCATION_SOURCE_DERIVED_ADDRESS = 'derived_address'

/**
 * @param {string} userId
 * @param {string} addressText
 * @param {{ lat: number, lng: number } | null} [precoded] — from Google Place Details (skips Nominatim)
 * @returns {Promise<{ success: boolean, error?: string, neighborhood?: { id: number, name: string } | null }>}
 */
export async function applyDerivedHomeFromAddress(userId, addressText, precoded = null) {
  if (!supabase || !userId) return { success: false, error: 'Not configured' }
  const addr = (addressText || '').trim()
  if (!addr) {
    await supabase
      .from('profiles')
      .update({
        home_address: null,
        home_lat: null,
        home_lng: null,
        home_neighborhood_id: null,
        home_neighborhood_name: null,
        derived_neighborhood_id: null,
        derived_neighborhood_name: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
    return { success: true, neighborhood: null }
  }

  let geo = precoded
  if (!geo || typeof geo.lat !== 'number' || typeof geo.lng !== 'number') {
    geo = await geocodeAddress(addr)
  }
  if (!geo) {
    await supabase
      .from('profiles')
      .update({
        home_address: addr,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
    return { success: true, neighborhood: null }
  }

  const { data: rows, error: rpcErr } = await supabase.rpc('resolve_neighborhood_from_coordinates', {
    p_lat: geo.lat,
    p_lng: geo.lng,
  })

  if (rpcErr) {
    console.warn('resolve_neighborhood_from_coordinates', rpcErr)
  }

  let neighborhood = null
  if (Array.isArray(rows) && rows.length > 0) {
    const r = rows[0]
    if (r?.neighborhood_id != null && r?.name) {
      neighborhood = { id: Number(r.neighborhood_id), name: String(r.name) }
    }
  }

  const patch = {
    home_address: addr,
    home_lat: geo.lat,
    home_lng: geo.lng,
    location_source: LOCATION_SOURCE_DERIVED_ADDRESS,
    derived_neighborhood_id: neighborhood ? neighborhood.id : null,
    derived_neighborhood_name: neighborhood ? neighborhood.name : null,
    updated_at: new Date().toISOString(),
  }

  if (neighborhood) {
    patch.home_neighborhood_id = neighborhood.id
    patch.home_neighborhood_name = neighborhood.name
  } else {
    patch.home_neighborhood_id = null
    patch.home_neighborhood_name = null
  }

  const { error } = await supabase.from('profiles').update(patch).eq('id', userId)
  if (error) return { success: false, error: error.message }
  return { success: true, neighborhood }
}
