/**
 * Canonical venue share URLs and copy for native share sheets.
 * Web URL is the primary shared link (previews + universal links when configured).
 * App scheme opens the in-app venue screen when the URL is handled by the OS.
 */

import { Share } from 'react-native'
import { config } from '../lib/config'

function trimBase(url) {
  if (!url || typeof url !== 'string') return ''
  return url.replace(/\/+$/, '')
}

/** Public web URL for a venue detail page (used in share messages). */
export function getVenueWebUrl(venueId) {
  const base = trimBase(config.webAppUrl) || 'https://nightout.app'
  const id = encodeURIComponent(String(venueId ?? ''))
  return `${base}/venue/${id}`
}

/** Custom scheme deep link (e.g. nightout://venue/:id). */
export function getVenueDeepLink(venueId) {
  const scheme = (config.appScheme || 'nightout').replace(/:\/?\/?$/, '')
  const id = encodeURIComponent(String(venueId ?? ''))
  return `${scheme}://venue/${id}`
}

export function buildVenueShareMessage(venueName) {
  const name = (venueName || 'this spot').trim()
  return `Check out this spot I found on NightOut: ${name}`
}

/**
 * Shares venue via the native sheet. Prefers web URL in the payload for link previews.
 */
export async function shareVenue({ venueId, venueName }) {
  const webUrl = getVenueWebUrl(venueId)
  const text = buildVenueShareMessage(venueName)
  const title = (venueName || 'Venue').trim()
  const message = `${text}\n\n${webUrl}`

  try {
    await Share.share({ message, title })
  } catch {
    /* user dismissed or share failed */
  }
}
