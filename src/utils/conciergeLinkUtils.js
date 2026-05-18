/**
 * Keep in sync with NightOut web: src/utils/conciergeLinkUtils.js
 */

import { expandVenueNameVariants } from './venueNameMatch'

const MIN_SINGLE_WORD_MENTION_LEN = 4

function isLinkableVariant(variant) {
  const t = (variant || '').trim()
  if (t.length < 2) return false
  if (t.includes(' ')) return true
  return t.length >= MIN_SINGLE_WORD_MENTION_LEN
}

function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function stripEdgePunctuation(s) {
  return String(s || '')
    .replace(/^[\s"'‘’“”([{«]+/, '')
    .replace(/[\s.,;:!?'"’”)\]}»\u2013\u2014]+$/, '')
    .trim()
}

function findHitForSegment(rows, rawPart) {
  const variants = []
  const add = (x) => {
    const t = (x || '').trim()
    if (!t) return
    const key = t.toLowerCase()
    if (!variants.some((v) => v.toLowerCase() === key)) variants.push(t)
  }
  add(rawPart)
  add(String(rawPart).replace(/^\*+|\*+$/g, '').trim())
  add(String(rawPart).replace(/['\u2018\u2019]/g, "'"))
  let s = String(rawPart || '')
  for (let i = 0; i < 4; i++) {
    const next = stripEdgePunctuation(s)
    if (!next) break
    add(next)
    add(next.replace(/['\u2018\u2019]/g, "'"))
    if (next === s) break
    s = next
  }
  let best = null
  for (const v of variants) {
    for (const row of rows) {
      if (row.pattern.toLowerCase() !== v.toLowerCase()) continue
      if (!best || row.pattern.length > best.pattern.length) best = row
    }
  }
  return best
}

export function splitTextWithVenueLinks(text, venues) {
  const raw = text || ''
  const rows = []
  const seenPattern = new Set()
  for (const v of venues || []) {
    const id = v.venueId ?? v.venue_id
    const name = (v.name || v.venue?.name || '').trim()
    if (id == null || name.length < 2) continue
    for (const variant of expandVenueNameVariants(name)) {
      if (!isLinkableVariant(variant)) continue
      const key = variant.toLowerCase()
      if (seenPattern.has(key)) continue
      seenPattern.add(key)
      rows.push({ id, pattern: variant })
    }
  }
  rows.sort((a, b) => b.pattern.length - a.pattern.length)

  if (rows.length === 0) return [{ type: 'text', text: raw }]

  const alts = rows.map((r) => escapeRe(r.pattern)).filter(Boolean)
  if (!alts.length) return [{ type: 'text', text: raw }]
  const re = new RegExp(`(?<![\\w])(${alts.join('|')})(?![\\w])`, 'gi')
  const parts = raw.split(re)
  const out = []
  for (const p of parts) {
    if (!p) continue
    const hit = findHitForSegment(rows, p)
    if (hit) out.push({ type: 'venue', text: p, venueId: hit.id })
    else out.push({ type: 'text', text: p })
  }
  return out.length ? out : [{ type: 'text', text: raw }]
}
