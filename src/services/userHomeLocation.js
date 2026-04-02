/**
 * Home neighborhood for recommendations (matches web src/services/userHomeLocation.js).
 */
import { supabase } from '../lib/supabase'

const LOCATION_SOURCE_MANUAL_NEIGHBORHOOD = 'manual_neighborhood'

async function findNeighborhoodByName(neighborhoodName) {
  const trimmed = (neighborhoodName || '').trim()
  if (!trimmed) return null
  const { data, error } = await supabase
    .from('neighborhoods')
    .select('neighborhood_id, name')
    .ilike('name', trimmed)
    .limit(1)
    .maybeSingle()
  if (error || !data) return null
  return data
}

async function getNeighborhoodCentroid(neighborhoodId) {
  const { data, error } = await supabase.rpc('get_neighborhood_centroid', {
    p_neighborhood_id: neighborhoodId,
  })
  if (error || !data || !Array.isArray(data) || data.length === 0) return null
  const row = data[0]
  return { lat: row.lat, lng: row.lng }
}

/**
 * @param {string} userId
 * @param {string} neighborhoodName - Canonical name from neighborhoods dropdown
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function setUserHomeNeighborhood(userId, neighborhoodName) {
  if (!userId) {
    return { success: false, error: 'userId required' }
  }
  const trimmed = (neighborhoodName || '').trim()
  if (!trimmed) {
    return { success: false, error: 'neighborhoodName required' }
  }

  const neighborhood = await findNeighborhoodByName(trimmed)
  if (!neighborhood) {
    return { success: false, error: `Neighborhood not found: "${trimmed}"` }
  }

  let lat = null
  let lng = null
  const centroid = await getNeighborhoodCentroid(neighborhood.neighborhood_id)
  if (centroid) {
    lat = centroid.lat
    lng = centroid.lng
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      home_neighborhood_name: neighborhood.name,
      home_neighborhood_id: neighborhood.neighborhood_id,
      home_lat: lat,
      home_lng: lng,
      location_source: LOCATION_SOURCE_MANUAL_NEIGHBORHOOD,
    })
    .eq('id', userId)

  if (error) {
    console.error('setUserHomeNeighborhood error:', error)
    return { success: false, error: error.message }
  }
  return { success: true }
}
