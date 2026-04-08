function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function splitTextWithVenueLinks(text, venues) {
  const raw = text || ''
  const list = (venues || [])
    .map((v) => {
      const id = v.venueId ?? v.venue_id
      const name = (v.name || v.venue?.name || '').trim()
      return { id, name }
    })
    .filter((v) => v.id != null && v.name.length > 1)
    .sort((a, b) => b.name.length - a.name.length)

  if (list.length === 0) return [{ type: 'text', text: raw }]

  const alts = list.map((v) => escapeRe(v.name)).filter(Boolean)
  if (!alts.length) return [{ type: 'text', text: raw }]
  const re = new RegExp(`(${alts.join('|')})`, 'gi')
  const parts = raw.split(re)
  const out = []
  for (const p of parts) {
    if (!p) continue
    const hit = list.find((v) => v.name.toLowerCase() === p.toLowerCase())
    if (hit) out.push({ type: 'venue', text: p, venueId: hit.id })
    else out.push({ type: 'text', text: p })
  }
  return out.length ? out : [{ type: 'text', text: raw }]
}
