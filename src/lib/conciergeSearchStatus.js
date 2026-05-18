/**
 * Immediate concierge loading copy — derived from the user's query only.
 * Keep in sync with NightOut web: src/utils/conciergeSearchStatus.js
 */

const PREFIXES = ['Searching for', 'Looking for', 'Finding']

const NEIGHBORHOOD_ALIASES = [
  'west loop',
  'river north',
  'lincoln park',
  'lakeview',
  'wicker park',
  'logan square',
  'gold coast',
  'old town',
  'bucktown',
  'hyde park',
  'south loop',
  'andersonville',
  'rogers park',
  'uptown',
  'wicker',
  'pilsen',
  'chinatown',
  'ukrainian village',
  'streeterville',
  'edgewater',
  'avondale',
  'bridgeport',
  'little italy',
  'greektown',
]

const CUISINE_TERMS = [
  ['dim sum', 'dim sum'],
  ['korean bbq', 'Korean BBQ'],
  ['fish and chips', 'fish and chips'],
  ['italian', 'Italian'],
  ['mexican', 'Mexican'],
  ['japanese', 'Japanese'],
  ['chinese', 'Chinese'],
  ['thai', 'Thai'],
  ['indian', 'Indian'],
  ['french', 'French'],
  ['greek', 'Greek'],
  ['korean', 'Korean'],
  ['vietnamese', 'Vietnamese'],
  ['american', 'American'],
  ['mediterranean', 'Mediterranean'],
  ['spanish', 'Spanish'],
  ['sushi', 'sushi'],
  ['pizza', 'pizza'],
  ['ramen', 'ramen'],
  ['pho', 'pho'],
  ['tacos', 'tacos'],
  ['seafood', 'seafood'],
  ['steak', 'steak'],
  ['bbq', 'BBQ'],
  ['barbecue', 'BBQ'],
  ['burger', 'burger'],
  ['burgers', 'burger'],
  ['brunch', 'brunch'],
  ['cocktail', 'cocktail'],
  ['coffee', 'coffee'],
  ['bakery', 'bakery'],
  ['tapas', 'tapas'],
  ['noodle', 'noodle'],
  ['noodles', 'noodle'],
]

const DIETARY_TERMS = [
  ['gluten-free', 'gluten-free'],
  ['gluten free', 'gluten-free'],
  ['dairy-free', 'dairy-free'],
  ['dairy free', 'dairy-free'],
  ['nut-free', 'nut-free'],
  ['nut free', 'nut-free'],
  ['plant-based', 'plant-based'],
  ['plant based', 'plant-based'],
  ['vegan', 'vegan'],
  ['vegetarian', 'vegetarian'],
  ['halal', 'halal'],
  ['kosher', 'kosher'],
  ['keto', 'keto'],
]

const VIBE_TERMS = [
  ['date night', 'date-night'],
  ['date-night', 'date-night'],
  ['cozy', 'cozy'],
  ['romantic', 'romantic'],
  ['casual', 'casual'],
  ['upscale', 'upscale'],
  ['lively', 'lively'],
  ['fun', 'fun'],
  ['quiet', 'quiet'],
  ['intimate', 'intimate'],
  ['trendy', 'trendy'],
  ['chill', 'chill'],
]

const PLACE_TYPE_PATTERNS = [
  [/\bsports\s+bars?\b/i, 'sports bars'],
  [/\bcocktail\s+bars?\b/i, 'cocktail bars'],
  [/\bwine\s+bars?\b/i, 'wine bars'],
  [/\bdive\s+bars?\b/i, 'dive bars'],
  [/\bbrunch\s+spots?\b/i, 'brunch spots'],
  [/\brestaurants?\b/i, 'restaurants'],
  [/\bbars?\b/i, 'bars'],
  [/\bspots?\b/i, 'spots'],
  [/\bplaces?\b/i, 'spots'],
  [/\bvenues?\b/i, 'spots'],
]

const FALLBACKS = [
  'Searching for matching spots...',
  'Looking for the best options...',
  'Finding places for you...',
]

const NOISE_RE =
  /^(?:can you|could you|please|help me|i(?:'m| am) looking for|i want|i need|looking for|find me|show me|give me|what are some|what are the|where should i go|where can i get|any|some|good|great|best|top|nice|decent|solid)\s+/i

function normQuery(input) {
  if (input == null) return ''
  if (typeof input === 'object' && typeof input.content === 'string') return input.content.trim()
  return String(input).trim()
}

function pickPrefix(query) {
  let h = 0
  for (let i = 0; i < query.length; i++) h = (h + query.charCodeAt(i)) % PREFIXES.length
  return PREFIXES[h]
}

function pickFallback(query) {
  let h = 0
  for (let i = 0; i < query.length; i++) h = (h + query.charCodeAt(i)) % FALLBACKS.length
  return FALLBACKS[h]
}

function titleCasePhrase(s) {
  return s
    .split(/\s+/)
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(' ')
}

function findFirstTerm(query, terms) {
  const q = query.toLowerCase()
  const sorted = [...terms].sort((a, b) => b[0].length - a[0].length)
  for (const [needle, label] of sorted) {
    const re = new RegExp(`\\b${needle.replace(/\s+/g, '\\s+').replace(/-/g, '[- ]?')}\\b`, 'i')
    if (re.test(q)) return label
  }
  return null
}

function findPlaceType(query) {
  for (const [re, label] of PLACE_TYPE_PATTERNS) {
    if (re.test(query)) return label
  }
  return null
}

function extractLocationSuffix(query) {
  const q = query.toLowerCase()
  if (/\b(near me|nearby|around me|close to me|by me)\b/.test(q)) return 'near you'

  for (const alias of NEIGHBORHOOD_ALIASES) {
    const re = new RegExp(`\\b${alias.replace(/\s+/g, '\\s+')}\\b`, 'i')
    if (re.test(query)) return `in ${titleCasePhrase(alias)}`
  }

  const inMatch = query.match(
    /\b(?:in|near|around|close to|by)\s+([a-z][a-z\s'-]{2,38}?)(?:\s+(?:for|with|that|who)|$|[,.!?])/i
  )
  if (inMatch?.[1]) {
    const loc = inMatch[1].trim()
    if (!/^(me|you|us|here|town|city)$/i.test(loc)) return `in ${titleCasePhrase(loc)}`
  }

  return null
}

function hasDateOccasion(query) {
  return /\b(?:for\s+a\s+date|date\s+night|date-night)\b/i.test(query)
}

function buildSubject(query) {
  const dietary = findFirstTerm(query, DIETARY_TERMS)
  const cuisine = findFirstTerm(query, CUISINE_TERMS)
  const vibe = findFirstTerm(query, VIBE_TERMS)
  const placeType = findPlaceType(query)
  const dateOccasion = hasDateOccasion(query)

  const parts = []

  if (dietary) parts.push(dietary)
  if (vibe && vibe !== 'date-night') parts.push(vibe)

  if (cuisine === 'brunch') {
    parts.push('brunch spots')
  } else if (cuisine === 'cocktail') {
    parts.push('cocktail bars')
  } else if (cuisine) {
    const restaurantCuisines = [
      'Italian', 'Mexican', 'Japanese', 'Chinese', 'Thai', 'Indian', 'French', 'Greek', 'Korean',
      'Vietnamese', 'American', 'Mediterranean', 'Spanish',
    ]
    if (placeType === 'restaurants' || (placeType && restaurantCuisines.includes(cuisine))) {
      parts.push(`${cuisine} restaurants`)
    } else if (placeType && placeType !== 'spots' && placeType !== 'places') {
      parts.push(`${cuisine} ${placeType}`)
    } else if (restaurantCuisines.includes(cuisine)) {
      parts.push(`${cuisine} restaurants`)
    } else {
      parts.push(`${cuisine} spots`)
    }
  } else if (placeType) {
    parts.push(placeType)
  } else if (vibe === 'fun') {
    parts.push('fun spots')
  } else if (vibe) {
    parts.push(`${vibe} spots`)
  }

  if (dateOccasion) parts.push('for a date')

  if (parts.length === 0) return null

  let subject = parts.join(' ')
  subject = subject.replace(/\s+/g, ' ').trim()

  if (/\bwith\s+\w+/i.test(query)) {
    const withMatch = query.match(/\bwith\s+([a-z][a-z\s'-]{1,24})/i)
    if (withMatch?.[1] && !/\b(you|me|friends|a view)\b/i.test(withMatch[1])) {
      subject = `${subject} with ${withMatch[1].trim().toLowerCase()}`
    }
  }

  return subject
}

function cleanQueryDescriptor(query) {
  let q = query.replace(/\?+$/, '').trim()
  let prev
  do {
    prev = q
    q = q.replace(NOISE_RE, '').trim()
  } while (q !== prev && q.length > 0)

  q = q.replace(/\b(?:in|near|around|close to|by)\s+[^,.!?]+/gi, '').trim()
  q = q.replace(/\b(?:near me|nearby)\b/gi, '').trim()
  q = q.replace(/\s+/g, ' ').trim()

  const words = q.split(/\s+/).filter(Boolean)
  if (words.length < 2 || words.length > 12) return null
  return q.toLowerCase()
}

/**
 * @param {string|{ content?: string }} userQuery
 * @param {{ location?: string, topic?: string }} [parsedIntent]
 * @returns {string}
 */
export function buildConciergeSearchStatusText(userQuery, parsedIntent) {
  const query = normQuery(userQuery)
  if (!query) return FALLBACKS[0]

  const prefix = pickPrefix(query)
  const location = parsedIntent?.location || extractLocationSuffix(query)
  let subject = parsedIntent?.topic ? String(parsedIntent.topic).trim().toLowerCase() : buildSubject(query)

  if (!subject) {
    const descriptor = cleanQueryDescriptor(query)
    if (descriptor) subject = descriptor
  }

  if (!subject) return pickFallback(query)

  let line = `${prefix} ${subject}`
  if (location) line += ` ${location}`
  if (!line.endsWith('...')) line += '...'
  return line
}
