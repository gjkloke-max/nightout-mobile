/**
 * Keep in sync with NightOut web: src/utils/venueMentionInText.js
 */

import { expandVenueNameVariants } from './venueNameMatch'
import {
  isKnownMicroNeighborhood,
  resolveMicroNeighborhood,
  resolveNeighborhoodTag,
} from '../vendor/pulse-web/src/utils/locationRegistry.js'

/** Skip linking single-word names this short (avoids matching common words like "art"). */
const MIN_SINGLE_WORD_MENTION_LEN = 4

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

/** Trailing venue-type tokens stripped by expandVenueNameVariants — not safe alone as link patterns. */
const VENUE_TYPE_SUFFIX =
  /^(?:restaurant|bar|grill|cafe|café|bistro|pub|tavern|diner|lounge|club|pizzeria|kitchen|house|room|social|steakhouse|chophouse|taproom|brewery|pizza|sushi|ramen|bakery|market|cantina|trattoria|osteria|brasserie|eatery|tap|shop|canteen|cantina)$/i

function normKey(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[''']/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * @param {string} phrase
 */
export function isKnownLocationPhrase(phrase) {
  const t = (phrase || '').trim()
  if (!t) return false
  return Boolean(resolveNeighborhoodTag(t) || resolveMicroNeighborhood(t) || isKnownMicroNeighborhood(t))
}

/**
 * @param {string} variant
 * @param {string} fullVenueName
 */
export function isUnsafeVenuePrefixVariant(variant, fullVenueName) {
  const v = normKey(variant)
  const full = normKey(fullVenueName)
  if (!v || !full || v === full) return false

  if (isKnownLocationPhrase(variant)) return true

  if (!full.startsWith(v)) return false
  const rest = full
    .slice(v.length)
    .trim()
    .replace(/^[-–—]+\s*/, '')
  if (!rest) return false

  const restWords = rest.split(/\s+/).filter(Boolean)
  if (restWords.length === 1 && VENUE_TYPE_SUFFIX.test(restWords[0])) return true
  if (restWords.length === 1 && restWords[0].length <= 10) return true
  return false
}

/**
 * @param {string} variant
 * @param {string} [fullVenueName]
 */
export function isSafeVenueLinkVariant(variant, fullVenueName = '') {
  const t = (variant || '').trim()
  if (t.length < 2) return false

  const full = (fullVenueName || '').trim()
  if (full && normKey(t) === normKey(full)) {
    // A short one-word name ("Aba", "AJI") is still the venue's whole name; isNameLikeOccurrence
    // then links it only where it is written exactly as named.
    return t.includes(' ') || t.length >= MIN_SINGLE_WORD_MENTION_LEN || !GENERIC_VENUE_LINK_BLOCKLIST.has(t.toLowerCase())
  }

  if (isUnsafeVenuePrefixVariant(t, full)) return false

  if (t.includes(' ')) return true
  const key = t.toLowerCase()
  if (GENERIC_VENUE_LINK_BLOCKLIST.has(key)) {
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
      const re = new RegExp(mentionBoundaryRe(escapeRe(variant)).source, 'gi')
      for (const m of haystack.matchAll(re)) {
        if (isNameLikeOccurrence(variant, m[0])) return true
      }
    } catch {
      /* ignore */
    }
  }
  return false
}

/**
 * A one-word form of a venue name ("Lemon") is also an ordinary word, so it counts as the venue
 * only where it is written as a name: capitalized. Multi-word forms count however they are cased.
 * Keep in sync with NightOut web: src/utils/venueMentionInText.js
 */
export function isNameLikeOccurrence(variant, occurrence) {
  const v = String(variant || '').trim()
  if (/\s/.test(v)) return true
  const occ = String(occurrence || '').trim()
  // Under four letters, only the exact spelling counts: "AJI" the restaurant, not aji the pepper.
  if (v.length < MIN_SINGLE_WORD_MENTION_LEN) return occ === v
  const first = occ.charAt(0)
  return first !== '' && first === first.toUpperCase()
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
