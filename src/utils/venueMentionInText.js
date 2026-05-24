/**
 * Keep in sync with NightOut web: src/utils/venueMentionInText.js
 */

import { expandVenueNameVariants } from './venueNameMatch'

/** Generic food/cuisine/service words that must not link as single-word venue mentions. */
export const GENERIC_VENUE_LINK_BLOCKLIST = new Set([
  'salad',
  'pizza',
  'steak',
  'coffee',
  'cocktails',
  'cocktail',
  'sushi',
  'ramen',
  'tacos',
  'burger',
  'bagel',
  'bagels',
  'pasta',
  'wine',
  'beer',
  'brunch',
  'breakfast',
  'lunch',
  'dinner',
  'dessert',
  'ice',
  'cream',
])

const MIN_SINGLE_WORD_MENTION_LEN = 4

/**
 * @param {string} variant
 * @param {string} [fullVenueName]
 */
export function isSafeVenueLinkVariant(variant, fullVenueName = '') {
  const t = (variant || '').trim()
  if (t.length < 2) return false
  if (t.includes(' ')) return true
  const key = t.toLowerCase()
  if (GENERIC_VENUE_LINK_BLOCKLIST.has(key)) {
    const full = (fullVenueName || '').trim()
    if (!full) return false
    return full.toLowerCase() === key
  }
  return t.length >= MIN_SINGLE_WORD_MENTION_LEN
}

function isLinkableVariant(variant, fullVenueName = '') {
  return isSafeVenueLinkVariant(variant, fullVenueName)
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
    if (!isLinkableVariant(variant, venueName)) continue
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
    if (!isLinkableVariant(variant, venueName)) continue
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
