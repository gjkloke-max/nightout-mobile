/**
 * Browse venue card tags — derived only from venue fields and review/search summaries.
 * No random or venue-id-based placeholders.
 */

import { filterGenericVenueType } from './venueProfileUtils'

function getVenueTypeName(venue) {
  const vt = Array.isArray(venue?.venue_type) ? venue.venue_type[0] : venue?.venue_type
  return (vt?.venue_type_name || '').trim()
}

function titleCase(s) {
  if (!s || typeof s !== 'string') return ''
  return s
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

/** Longer / more specific patterns first */
const PLACE_FROM_TEXT = [
  { re: /\bsports\s+bars?\b/i, label: 'Sports bar' },
  { re: /\bcocktail\s+bars?\b/i, label: 'Cocktail bar' },
  { re: /\bwine\s+bars?\b/i, label: 'Wine bar' },
  { re: /\brooftop\b/i, label: 'Rooftop' },
  { re: /\bbrewery|brewpubs?\b/i, label: 'Brewery' },
  { re: /\btaproom\b/i, label: 'Taproom' },
  { re: /\bcoffee\s+shop|cafes?\b/i, label: 'Cafe' },
  { re: /\bsteakhouses?\b/i, label: 'Steakhouse' },
  { re: /\bsushi\b/i, label: 'Sushi' },
  { re: /\bramen\b/i, label: 'Ramen' },
  { re: /\btacos?|mexican\b/i, label: 'Mexican' },
  { re: /\bindian\b/i, label: 'Indian' },
  { re: /\bitalian\b/i, label: 'Italian' },
  { re: /\bthai\b/i, label: 'Thai' },
  { re: /\bvietnamese\b/i, label: 'Vietnamese' },
  { re: /\bkorean\b/i, label: 'Korean' },
  { re: /\bjapanese\b/i, label: 'Japanese' },
  { re: /\bchinese\b/i, label: 'Chinese' },
  { re: /\bfrench\b/i, label: 'French' },
  { re: /\bmediterranean\b/i, label: 'Mediterranean' },
  { re: /\bseafood\b/i, label: 'Seafood' },
  { re: /\bbbq|barbecue\b/i, label: 'BBQ' },
  { re: /\bbrunch\b/i, label: 'Brunch' },
  { re: /\bpizza\b/i, label: 'Pizza' },
  { re: /\bburger\b/i, label: 'Burgers' },
  { re: /\bgastropub\b/i, label: 'Gastropub' },
  { re: /\bpub\b/i, label: 'Pub' },
  { re: /\blounge\b/i, label: 'Lounge' },
  { re: /\bnight\s*club|nightclub\b/i, label: 'Nightclub' },
  { re: /\bbakery\b/i, label: 'Bakery' },
]

const VIBE_FROM_TEXT = [
  { re: /\bdate\s+night\b/i, label: 'Date night' },
  { re: /\bromantic\b/i, label: 'Romantic' },
  { re: /\bcozy|intimate\b/i, label: 'Cozy' },
  { re: /\blively|buzzing|vibrant\b/i, label: 'Lively' },
  { re: /\bcasual\b/i, label: 'Casual' },
  { re: /\bupscale|up-market|fine\s+dining\b/i, label: 'Upscale' },
  { re: /\bneighborhood|locals?\b/i, label: 'Neighborhood favorite' },
  { re: /\bpatio|outdoor\s+seating|al\s+fresco\b/i, label: 'Outdoor seating' },
  { re: /\bgroup|large\s+party|celebration\b/i, label: 'Great for groups' },
  { re: /\bhappy\s+hour\b/i, label: 'Happy hour' },
  { re: /\blate\s*night\b/i, label: 'Late night' },
  { re: /\bfamily|kid[s]?\b/i, label: 'Family-friendly' },
  { re: /\blive\s+music\b/i, label: 'Live music' },
]

function summaryBlob(venue) {
  return [venue?.compact_summary, venue?.review_summary, venue?.editorial_summary]
    .filter((s) => s && typeof s === 'string')
    .join(' ')
}

function firstPlaceLabel(blob) {
  if (!blob) return ''
  for (const { re, label } of PLACE_FROM_TEXT) {
    if (re.test(blob)) return label
  }
  return ''
}

function firstVibeLabel(blob) {
  if (!blob) return ''
  for (const { re, label } of VIBE_FROM_TEXT) {
    if (re.test(blob)) return label
  }
  return ''
}

/**
 * @returns {{ primary: string, secondary: string }}
 */
export function deriveBrowseTagPair(venue) {
  const blob = summaryBlob(venue)
  const cuisine = (venue?.cuisine_type && String(venue.cuisine_type).trim()) || ''
  const rawTypeName = getVenueTypeName(venue)
  const filteredType = filterGenericVenueType(rawTypeName)
  const placeFromSummary = firstPlaceLabel(blob)
  const vibe = firstVibeLabel(blob)

  let primary = ''
  if (filteredType) primary = titleCase(filteredType)
  else if (cuisine) primary = titleCase(cuisine)
  else if (placeFromSummary) primary = placeFromSummary
  else if (rawTypeName) primary = titleCase(rawTypeName)

  if (!primary) {
    const n = (venue?.neighborhood_name || '').trim()
    primary = n ? titleCase(n) : 'Venue'
  }

  const pNorm = primary.toLowerCase()

  let secondary = ''
  if (vibe && vibe.toLowerCase() !== pNorm) secondary = vibe
  else if (cuisine && titleCase(cuisine).toLowerCase() !== pNorm) secondary = titleCase(cuisine)
  else if (placeFromSummary && placeFromSummary.toLowerCase() !== pNorm) secondary = placeFromSummary
  else if (filteredType && titleCase(filteredType).toLowerCase() !== pNorm) secondary = titleCase(filteredType)
  else {
    const n = (venue?.neighborhood_name || '').trim()
    if (n && titleCase(n).toLowerCase() !== pNorm) secondary = titleCase(n)
  }

  if (!secondary && rawTypeName && titleCase(rawTypeName).toLowerCase() !== pNorm) {
    secondary = titleCase(rawTypeName)
  }

  if (!secondary) secondary = primary

  return { primary, secondary }
}
