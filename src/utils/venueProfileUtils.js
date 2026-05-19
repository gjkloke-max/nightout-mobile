/**
 * Shared utilities for venue profile components.
 */

export function truncateToWords(text, maxWords = 45) {
  if (!text || typeof text !== 'string') return ''
  const words = text.trim().split(/\s+/)
  if (words.length <= maxWords) return text.trim()
  return words.slice(0, maxWords).join(' ') + '…'
}

export function cleanUrl(url) {
  if (!url || typeof url !== 'string') return url
  try {
    const u = new URL(url)
    return `${u.protocol}//${u.host}${u.pathname}`
  } catch (e) {
    return url.split('?')[0].split('#')[0]
  }
}

export function buildCrowdSentimentSourceText(venue, reviews = []) {
  const fromSearch = (venue?.search_text || '').trim()
  if (fromSearch) return fromSearch

  const reviewTexts = (reviews || [])
    .map((r) => r?.review_text)
    .filter((t) => t && typeof t === 'string')
  const summary = [venue?.compact_summary, venue?.review_summary, venue?.editorial_summary]
    .filter((s) => s && typeof s === 'string')
    .join(' ')
  return [...reviewTexts, summary].filter(Boolean).join(' ')
}

export { deriveCrowdSentiment } from './crowdSentimentTags.js'

export function filterGenericVenueType(typeName) {
  if (!typeName || typeof typeName !== 'string') return ''
  const lower = typeName.trim().toLowerCase()
  const generic = ['restaurant', 'food', 'point_of_interest', 'point of interest', 'establishment', 'store']
  if (generic.includes(lower)) return ''
  return typeName.trim()
}

export function formatFullAddress(venue) {
  const state = Array.isArray(venue?.state) ? venue.state[0] : venue?.state
  const address = [venue?.address_1, venue?.address_2].filter(Boolean).join(', ')
  const cityState = [venue?.city, state?.state_code, venue?.zip].filter(Boolean).join(', ')
  return [address, cityState].filter(Boolean).join(', ')
}

/** @returns {{ lat: number, lng: number } | null} */
export function parseVenueLatLng(venue) {
  if (!venue) return null
  const parseCoord = (v) => {
    if (v == null) return NaN
    if (typeof v === 'string' && v.trim() === '') return NaN
    const n = Number(v)
    return Number.isFinite(n) ? n : NaN
  }
  const lat = parseCoord(venue.latitude)
  const lng = parseCoord(venue.longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null
  return { lat, lng }
}

export function formatPriceLevel(priceLevel) {
  const n = Number(priceLevel)
  if (n === 1) return '$'
  if (n === 2) return '$$'
  if (n === 3) return '$$$'
  if (n === 4) return '$$$$'
  return null
}

export function isVenueTemporarilyClosed(venue) {
  if (!venue) return false
  if (venue.status === 'temporarily_closed') return true
  const bs = String(venue.business_status || '').toUpperCase()
  return bs === 'CLOSED_TEMPORARILY'
}
