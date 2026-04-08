/**
 * Venue image for social feed / review cards (Figma: square thumb in venue row).
 */
export function venueFeedThumbUrl(venue) {
  if (!venue) return null
  const primary = (venue.primary_photo_url || '').trim()
  if (primary) return primary
  const urls = venue.photo_urls
  if (Array.isArray(urls)) {
    for (const u of urls) {
      const s = (u || '').trim()
      if (s) return s
    }
  }
  return null
}
