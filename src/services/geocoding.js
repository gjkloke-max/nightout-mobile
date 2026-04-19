/**
 * Forward geocode street address → lat/lng (Nominatim). Non-blocking for UX; failures return null.
 */
const USER_AGENT = 'NightOutMobile/1.0 (contact: app)'

/**
 * @param {string} address
 * @returns {Promise<{ lat: number, lng: number, displayName?: string } | null>}
 */
export async function geocodeAddress(address) {
  const q = (address || '').trim()
  if (q.length < 4) return null
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
    if (!res.ok) return null
    const data = await res.json()
    if (!Array.isArray(data) || data.length === 0) return null
    const row = data[0]
    const lat = parseFloat(row.lat)
    const lng = parseFloat(row.lon)
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null
    return { lat, lng, displayName: row.display_name }
  } catch {
    return null
  }
}
