import { deriveBrowseTagPair } from './browseVenueTags'

/** Stored as first line of dm_messages.body — must match web `NightOut` */
export const DM_VENUE_SHARE_MARKER = 'NIGHTOUT_VENUE_SHARE_V1'

function venueThumbUrl(venue) {
  if (Array.isArray(venue?.photo_urls) && venue.photo_urls[0]) return venue.photo_urls[0]
  return venue?.primary_photo_url || null
}

export function buildVenueShareSnapshot(venue) {
  if (!venue?.venue_id) return null
  const { primary: typeTag, secondary: vibeTag } = deriveBrowseTagPair(venue)
  const tags = [typeTag, vibeTag].filter(Boolean).map((t) => String(t))
  return {
    v: 1,
    venueId: venue.venue_id,
    name: venue?.name || 'Venue',
    photoUrl: venueThumbUrl(venue),
    neighborhood: (venue?.neighborhood_name || '').trim() || null,
    rating10: venue?.rating10 != null ? Number(venue.rating10) : null,
    tags,
  }
}

export function serializeVenueShareDm(venue, optionalText) {
  const snap = buildVenueShareSnapshot(venue)
  if (!snap) throw new Error('invalid venue')
  const json = JSON.stringify(snap)
  let body = `${DM_VENUE_SHARE_MARKER}\n${json}`
  const t = (optionalText || '').trim()
  if (t) body += `\n\n${t}`
  return body
}

export function parseVenueShareDm(body) {
  if (!body || typeof body !== 'string') return null
  if (!body.startsWith(`${DM_VENUE_SHARE_MARKER}\n`)) return null
  const rest = body.slice(DM_VENUE_SHARE_MARKER.length + 1)
  const sep = '\n\n'
  const d = rest.indexOf(sep)
  let jsonPart = d === -1 ? rest : rest.slice(0, d)
  const caption = d === -1 ? '' : rest.slice(d + sep.length).trim()
  jsonPart = jsonPart.trim()
  try {
    const snapshot = JSON.parse(jsonPart)
    if (snapshot?.v !== 1 || snapshot?.venueId == null) return null
    return { snapshot, caption: caption || null }
  } catch {
    return null
  }
}

export function formatDmMessagePreview(body) {
  const parsed = parseVenueShareDm(body)
  if (parsed) {
    const name = parsed.snapshot?.name || 'a venue'
    if (parsed.caption) {
      const c = parsed.caption
      return c.length > 72 ? `${c.slice(0, 69)}…` : c
    }
    return `Shared ${name}`
  }
  return body || ''
}
