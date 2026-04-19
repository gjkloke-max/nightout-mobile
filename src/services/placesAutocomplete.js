/**
 * Google Places (legacy REST) — address autocomplete + place details for lat/lng.
 * Set EXPO_PUBLIC_GOOGLE_MAPS_API_KEY (Places + Geocoding APIs enabled).
 */
import { config } from '../lib/config'

/**
 * @param {string} input
 * @returns {Promise<Array<{ placeId: string, description: string }>>}
 */
export async function fetchAddressPredictions(input) {
  const key = config.googleMapsApiKey
  const q = (input || '').trim()
  if (!key || q.length < 3) return []

  try {
    const params = new URLSearchParams({
      input: q,
      types: 'address',
      key,
      components: 'country:us',
    })
    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params.toString()}`
    const res = await fetch(url)
    const json = await res.json()
    if (json.status !== 'OK' && json.status !== 'ZERO_RESULTS') {
      if (__DEV__) console.warn('[places] autocomplete', json.status, json.error_message)
      return []
    }
    const preds = json.predictions || []
    return preds.map((p) => ({ placeId: p.place_id, description: p.description }))
  } catch (e) {
    if (__DEV__) console.warn('[places] autocomplete fetch', e)
    return []
  }
}

/**
 * @param {string} placeId
 * @returns {Promise<{ formattedAddress: string, lat: number, lng: number } | null>}
 */
export async function fetchPlaceDetails(placeId) {
  const key = config.googleMapsApiKey
  if (!key || !placeId) return null

  try {
    const params = new URLSearchParams({
      place_id: placeId,
      fields: 'formatted_address,geometry/location',
      key,
    })
    const url = `https://maps.googleapis.com/maps/api/place/details/json?${params.toString()}`
    const res = await fetch(url)
    const json = await res.json()
    if (json.status !== 'OK' || !json.result?.geometry?.location) {
      if (__DEV__) console.warn('[places] details', json.status)
      return null
    }
    const r = json.result
    const lat = r.geometry.location.lat
    const lng = r.geometry.location.lng
    if (typeof lat !== 'number' || typeof lng !== 'number') return null
    return {
      formattedAddress: r.formatted_address || '',
      lat,
      lng,
    }
  } catch (e) {
    if (__DEV__) console.warn('[places] details fetch', e)
    return null
  }
}

export function hasGooglePlacesKey() {
  return Boolean(config.googleMapsApiKey && String(config.googleMapsApiKey).length > 10)
}
