/**
 * Keep in sync with NightOut web: src/utils/venueMentionInText.js
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

function mentionBoundaryRe(escapedVariant) {
  return new RegExp(`(?<![\\w])${escapedVariant}(?![\\w])`, 'i')
}

export function venueNameAppearsInText(text, venueName) {
  const haystack = text || ''
  if (!haystack.trim()) return false
  for (const variant of expandVenueNameVariants(venueName)) {
    if (!isLinkableVariant(variant)) continue
    try {
      if (mentionBoundaryRe(escapeRe(variant)).test(haystack)) return true
    } catch {
      /* ignore */
    }
  }
  return false
}

export function firstIndexOfVenueNameInText(textLower, venueName) {
  let best = Infinity
  for (const variant of expandVenueNameVariants(venueName)) {
    const i = textLower.indexOf(variant.toLowerCase())
    if (i >= 0 && i < best) best = i
  }
  return best === Infinity ? -1 : best
}

export function filterVenuesMentionedInText(text, venues, getName = (v) => v?.name || v?.venue?.name) {
  const out = []
  const seen = new Set()
  for (const v of venues || []) {
    const name = (getName(v) || '').trim()
    if (!name) continue
    const id = v?.venueId ?? v?.venue_id ?? v?.id
    const key = id != null ? String(id) : name.toLowerCase()
    if (seen.has(key)) continue
    if (!venueNameAppearsInText(text, name)) continue
    seen.add(key)
    out.push(v)
  }
  return out
}
