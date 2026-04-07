/**
 * Shared utilities for venue profile components.
 */

export function truncateToWords(text, maxWords = 45) {
  if (!text || typeof text !== 'string') return ''
  const words = text.trim().split(/\s+/)
  if (words.length <= maxWords) return text.trim()
  return words.slice(0, maxWords).join(' ') + '…'
}

export function cleanUrl(url) {
  if (!url || typeof url !== 'string') return url
  try {
    const u = new URL(url)
    return `${u.protocol}//${u.host}${u.pathname}`
  } catch (e) {
    return url.split('?')[0].split('#')[0]
  }
}

export function deriveCrowdSentiment(combinedText) {
  if (!combinedText || typeof combinedText !== 'string') return []
  const lower = combinedText.toLowerCase()
  const themes = []
  /** Grounded in review/summary text only; labels kept fair (no harsh callouts). */
  const patterns = [
    { phrases: ['cozy', 'intimate'], label: 'Cozy, intimate atmosphere', cat: 'ambience-cozy' },
    { phrases: ['romantic'], label: 'Romantic vibe', cat: 'ambience-romantic' },
    { phrases: ['casual'], label: 'Casual atmosphere', cat: 'ambience-casual' },
    { phrases: ['upscale'], label: 'Upscale feel', cat: 'ambience-upscale' },
    { phrases: ['lively'], label: 'Lively energy', cat: 'ambience-lively' },
    { phrases: ['date night'], label: 'Popular for date nights', cat: 'crowd-date' },
    { phrases: ['groups', 'group dining'], label: 'Good for groups', cat: 'crowd-groups' },
    { phrases: ['pasta'], label: 'Strong pasta mentions', cat: 'food-pasta' },
    { phrases: ['steak', 'ribeye', 'filet'], label: 'Steak frequently mentioned', cat: 'food-steak' },
    { phrases: ['cocktail', 'cocktails'], label: 'Cocktails are a highlight', cat: 'drink-cocktails' },
    { phrases: ['wine'], label: 'Wine selection noted', cat: 'drink-wine' },
    { phrases: ['sushi'], label: 'Sushi gets attention', cat: 'food-sushi' },
    { phrases: ['brunch'], label: 'Brunch favorite', cat: 'food-brunch' },
    { phrases: ['pizza'], label: 'Pizza often mentioned', cat: 'food-pizza' },
    {
      phrases: ['great service', 'good service', 'friendly staff', 'attentive', 'excellent service', 'helpful staff'],
      label: 'Service is often praised',
      cat: 'service-praised',
    },
    { phrases: ['crowded', 'packed'], label: 'Lively and popular', cat: 'crowd-busy' },
    { phrases: ['weekend', 'weekends'], label: 'Popular on weekends', cat: 'crowd-weekend' },
    { phrases: ['portion', 'portions'], label: 'Portions are a recurring talking point', cat: 'practical-portions' },
    { phrases: ['patio', 'outdoor'], label: 'Patio or outdoor seating', cat: 'practical-outdoor' },
    { phrases: ['happy hour'], label: 'Happy hour noted', cat: 'practical-hh' },
    { phrases: ['live music'], label: 'Live music', cat: 'practical-music' },
  ]
  const seen = new Set()
  for (const { phrases, label, cat } of patterns) {
    if (seen.has(cat)) continue
    if (phrases.some((p) => lower.includes(p))) {
      seen.add(cat)
      themes.push(label)
    }
  }
  return themes.slice(0, 8)
}

export function filterGenericVenueType(typeName) {
  if (!typeName || typeof typeName !== 'string') return ''
  const lower = typeName.trim().toLowerCase()
  const generic = ['restaurant', 'food', 'point_of_interest', 'point of interest', 'establishment', 'store']
  if (generic.includes(lower)) return ''
  return typeName.trim()
}

export function formatFullAddress(venue) {
  const state = Array.isArray(venue?.state) ? venue.state[0] : venue?.state
  const address = [venue?.address_1, venue?.address_2].filter(Boolean).join(', ')
  const cityState = [venue?.city, state?.state_code, venue?.zip].filter(Boolean).join(', ')
  return [address, cityState].filter(Boolean).join(', ')
}
