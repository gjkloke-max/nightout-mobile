/**
 * Variants for matching venue display names in prose and for inline concierge links.
 * Handles apostrophes, "Name – Location" splits, and no-apostrophe spellings (e.g. Paulie's / Paulies).
 */

function collapseSpaces(s) {
  return String(s || '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Lowercase letters only — for matching "Sushi San" to "Sushi-San", "Paulie's" to "Paulies", etc.
 * @param {string} s
 * @returns {string}
 */
export function normalizeVenueNameAlpha(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z]/g, '')
}

/**
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function venueNamesAlphaEqual(a, b) {
  const na = normalizeVenueNameAlpha(a)
  const nb = normalizeVenueNameAlpha(b)
  return na.length >= 2 && na === nb
}

/**
 * @param {string} hint
 * @param {string} venueName
 * @returns {'exact_alpha' | 'prefix_alpha' | 'contains_alpha' | 'contains_raw' | null}
 */
export function classifyVenueNameMatchTier(hint, venueName) {
  const h = normalizeVenueNameAlpha(hint)
  const n = normalizeVenueNameAlpha(venueName)
  if (h.length < 2 || n.length < 2) return null
  if (h === n) return 'exact_alpha'
  if (n.startsWith(h)) return 'prefix_alpha'
  if (n.includes(h)) return 'contains_alpha'
  const raw = collapseSpaces(venueName).toLowerCase()
  const hintRaw = collapseSpaces(hint).toLowerCase()
  if (hintRaw.length >= 2 && raw.includes(hintRaw)) return 'contains_raw'
  return null
}

/**
 * Accepts exact_alpha and prefix_alpha tier matches only (not contains_alpha/contains_raw, which
 * are too loose for "resolve this as THE venue" precedence - a short common word could contains-
 * match many unrelated venues). prefix_alpha covers how people actually refer to venues whose DB
 * name carries a location/style suffix they never type ("Milly's Pizza" -> "Milly's Pizza In The
 * Pan"): the hint's alpha string is genuinely the venue's own name in full, just missing a suffix,
 * not a coincidental substring.
 * @param {Array<{ name?: string }>} rows
 * @param {string} hint
 * @returns {Array<{ name?: string, name_match_tier: string }>}
 */
export function filterExactAlphaVenueMatches(rows, hint) {
  return (rows || []).filter((r) => {
    const tier = classifyVenueNameMatchTier(hint, r?.name)
    return tier === 'exact_alpha' || tier === 'prefix_alpha'
  })
}

/**
 * @param {string} name — DB or card display name
 * @returns {string[]} unique variants, longest first (better for regex alternation)
 */
export function expandVenueNameVariants(name) {
  const raw = collapseSpaces(name)
  if (raw.length < 2) return []

  const out = new Set()
  const add = (s) => {
    const t = collapseSpaces(s)
    if (t.length >= 2) out.add(t)
  }

  add(raw)
  const uni = raw.replace(/[''\u2018\u2019]/g, "'")
  add(uni)

  const primary = uni.split(/\s*[-–—]\s*/)[0] || ''
  if (primary && primary.trim() !== uni) add(primary)

  add(uni.replace(/'/g, ''))

  if (/\s&\s/.test(uni)) add(uni.replace(/\s*&\s*/g, ' and '))
  if (/\sand\s/i.test(uni)) add(uni.replace(/\s+and\s+/gi, ' & '))

  const typeStripped = uni
    .replace(/\s+(restaurant|bar|grill|cafe|bistro|pub|tavern|diner|lounge|club|pizza|pizzeria)$/i, '')
    .replace(/^(the|a|an)\s+/i, '')
    .trim()
  if (typeStripped.length > 3 && typeStripped !== uni) {
    add(typeStripped)
    add(typeStripped.replace(/'/g, ''))
  }

  return [...out].sort((a, b) => b.length - a.length)
}
