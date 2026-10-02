/**
 * Address autocomplete + place details, via our own server.
 *
 * These used to call maps.googleapis.com directly with EXPO_PUBLIC_GOOGLE_MAPS_API_KEY. That key
 * ships inside the app bundle — an .ipa or .aab unzips and the key is right there — and it could
 * not be locked down: Google's iOS/Android application restrictions are checked against headers
 * (X-Ios-Bundle-Identifier, X-Android-Package/-Cert) that the native Maps SDKs attach and a plain
 * fetch() does not, so enabling one would have rejected every request rather than securing it.
 * Web-service keys only accept IP restrictions, which a phone can never satisfy.
 *
 * So the call moved behind /api/places/* on the search API, where the key can be IP-restricted to
 * that server. The endpoints return exactly the two shapes below rather than Google's response, so
 * no caller can widen `fields` or reach a different Places endpoint on our billing.
 */
import { config } from '../lib/config'

const TIMEOUT_MS = 8000

function baseUrl() {
  return String(config.searchApiUrl || '').replace(/\/+$/, '')
}

async function getJson(path, params) {
  const base = baseUrl()
  if (!base) return null
  const qs = new URLSearchParams(params).toString()
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`${base}/api/places/${path}?${qs}`, { signal: ac.signal })
    // 4xx/5xx still carry a usable body (an empty prediction list, or an error code), and the
    // callers below treat "no answer" and "bad answer" the same way, so parse either.
    return await res.json()
  } catch (e) {
    if (__DEV__) {
      console.warn(`[places] ${path}`, e?.name === 'AbortError' ? 'timeout' : e)
    }
    return null
  } finally {
    clearTimeout(timer)
  }
}

/**
 * @param {string} input
 * @returns {Promise<Array<{ placeId: string, description: string }>>}
 */
export async function fetchAddressPredictions(input) {
  const q = (input || '').trim()
  if (q.length < 1) return []
  const json = await getJson('autocomplete', { input: q })
  const preds = json?.predictions
  if (!Array.isArray(preds)) return []
  return preds
    .filter((p) => p?.placeId && p?.description)
    .map((p) => ({ placeId: String(p.placeId), description: String(p.description) }))
}

/**
 * @param {string} placeId
 * @returns {Promise<{ formattedAddress: string, lat: number, lng: number } | null>}
 */
export async function fetchPlaceDetails(placeId) {
  if (!placeId) return null
  const json = await getJson('details', { place_id: placeId })
  const lat = json?.lat
  const lng = json?.lng
  if (typeof lat !== 'number' || typeof lng !== 'number') return null
  return { formattedAddress: String(json.formattedAddress || ''), lat, lng }
}

/**
 * Whether the address fields should offer autocomplete at all. Previously this asked whether a
 * Google key was present in the bundle; the key now lives on the server, so the question is
 * whether we know where that server is.
 */
export function hasAddressAutocomplete() {
  return Boolean(baseUrl())
}
