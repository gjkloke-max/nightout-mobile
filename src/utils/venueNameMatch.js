/**
 * Keep in sync with NightOut web: src/utils/venueNameMatch.js
 */

function collapseSpaces(s) {
  return String(s || '')
    .replace(/\s+/g, ' ')
    .trim()
}

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
