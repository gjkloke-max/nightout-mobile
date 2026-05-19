/**
 * Keep in sync with NightOut `src/utils/conciergeConversationState.js`.
 */

import { venueNameAppearsInText } from './venueMentionInText.js'

function detectNeighborhoodIntent(query) {
  return { detected: null, queryWithoutNeighborhood: query || '' }
}

export const FOLLOW_UP_NEW_SEARCH = 'new_search'
export const FOLLOW_UP_RESULT_SET_REFINEMENT = 'result_set_refinement'
export const FOLLOW_UP_SINGLE_VENUE = 'single_venue_followup'
export const FOLLOW_UP_COMPARISON = 'comparison_followup'

const ORDINAL_INDEX = {
  first: 0,
  '1st': 0,
  one: 0,
  second: 1,
  '2nd': 1,
  two: 1,
  third: 2,
  '3rd': 2,
  three: 2,
  fourth: 3,
  '4th': 3,
  four: 3,
  fifth: 4,
  '5th': 4,
  five: 4,
}

const NEW_SEARCH_SIGNALS = [
  /\binstead\b/i,
  /\bactually\b\s+(?:show|find|give|i\s+want|looking)/i,
  /\bswitch\s+to\b/i,
  /\bchange\s+to\b/i,
  /\bforget\s+(?:that|the)\b/i,
  /\bnever\s+mind\b/i,
  /\bscratch\s+that\b/i,
  /\bwhat\s+are\s+the\s+best\b/i,
  /\bshow\s+me\s+(?:some\s+)?(?:new|different|other)\b/i,
  /\bgive\s+me\s+(?:some\s+)?(?:new|different|other|more)\s+(?:options?|places?|venues?|restaurants?)\b/i,
  /\b(?:more|additional|other|another)\s+(?:options?|choices?|suggestions?|recommendations?|places?|venues?|restaurants?)\s*$/i,
  /^(?:more|additional|other|another|different|more options|give me more|show me more|any others?|what else)\s*$/i,
]

const RESULT_SET_REFINEMENT_SIGNALS = [
  /\b(?:do|does|did)\s+(?:any|some|one)\s+of\s+(?:those|them|these)\b/i,
  /\b(?:which|what)\s+of\s+(?:those|them|these)\b/i,
  /\b(?:any|some)\s+of\s+(?:those|them|these)\b/i,
  /\b(?:those|them|these)\s+(?:places?|spots?|venues?|restaurants?)\b/i,
  /\b(?:the\s+)?(?:places?|spots?|venues?|restaurants?)\s+you\s+(?:mentioned|recommended|suggested|listed)\b/i,
  /\b(?:do|does|are|is)\s+(?:they|them)\s+/i,
  /\bwhich\s+(?:one|ones)\s+(?:has|have|is|are|serves?|offers?)\b/i,
  /\b(?:cheapest|priciest|most expensive|best for groups?|good for groups?|take reservations?|outdoor|patio|wings?|vegan|gluten)\b.*\b(?:those|them|these)\b/i,
  /\b(?:those|them|these)\b.*\b(?:too|also|as well)\b/i,
]

const COMPARISON_SIGNALS = [
  /\bwhich\s+(?:is|are|one is|ones are)\s+(?:better|best|worse|cozier|nicer|cheaper|quieter|louder)\b/i,
  /\bwhich\s+of\s+(?:those|them|these)\s+(?:is|are|feels?|sounds?|seems?)\b/i,
  /\b(?:rank|order|sort)\s+(?:those|them|these)\b/i,
  /\bcompare\b/i,
  /\b(?:between|vs\.?|versus)\b/i,
  /\bwhich\s+(?:feels?|sounds?|seems?)\s+/i,
]

const SINGLE_VENUE_SIGNALS = [
  /\btell\s+me\s+more\s+about\b/i,
  /\bmore\s+about\b/i,
  /\bwhat\s+about\s+(?:the\s+)?(?:first|second|third|fourth|fifth|last)\s+(?:one|place|spot|venue|restaurant)\b/i,
  /\b(?:the\s+)?(?:first|second|third|fourth|fifth|last)\s+(?:one|place|spot|venue|restaurant)\b/i,
  /\bthat\s+(?:place|one|spot|venue|restaurant)\b/i,
  /\bthis\s+(?:place|one|spot|venue|restaurant)\b/i,
  /\bdoes\s+(?:that|this)\s+place\b/i,
  /\bis\s+(?:that|this)\s+place\b/i,
  /\bhow\s+is\s+(?:that|this)\s+place\b/i,
]

function norm(s) {
  return (s || '').toLowerCase().trim().replace(/\s+/g, ' ')
}

export function emptyRecommendationState() {
  return {
    version: 1,
    last_recommended_venue_ids: [],
    last_recommended_venue_names: [],
    last_result_order: [],
    last_search_intent: null,
    last_location: null,
    last_cuisine: null,
    last_place_type: null,
    last_format: null,
    last_dietary: null,
    last_vibe: null,
    currently_focused_venue_id: null,
  }
}

export function normalizeRecommendationState(raw) {
  const base = emptyRecommendationState()
  if (!raw || typeof raw !== 'object') return base
  const ids = Array.isArray(raw.last_recommended_venue_ids)
    ? raw.last_recommended_venue_ids.map((id) => parseInt(String(id), 10)).filter((n) => !isNaN(n))
    : []
  const names = Array.isArray(raw.last_recommended_venue_names)
    ? raw.last_recommended_venue_names.map((n) => String(n || '').trim()).filter(Boolean)
    : []
  return {
    ...base,
    last_recommended_venue_ids: ids,
    last_recommended_venue_names: names,
    last_result_order: Array.isArray(raw.last_result_order)
      ? raw.last_result_order.map((id) => parseInt(String(id), 10)).filter((n) => !isNaN(n))
      : ids,
    last_search_intent: raw.last_search_intent != null ? String(raw.last_search_intent) : null,
    last_location: raw.last_location != null ? String(raw.last_location) : null,
    last_cuisine: raw.last_cuisine != null ? String(raw.last_cuisine) : null,
    last_place_type: raw.last_place_type != null ? String(raw.last_place_type) : null,
    last_format: raw.last_format != null ? String(raw.last_format) : null,
    last_dietary: raw.last_dietary != null ? String(raw.last_dietary) : null,
    last_vibe: raw.last_vibe != null ? String(raw.last_vibe) : null,
    currently_focused_venue_id:
      raw.currently_focused_venue_id != null && !isNaN(parseInt(String(raw.currently_focused_venue_id), 10))
        ? parseInt(String(raw.currently_focused_venue_id), 10)
        : null,
  }
}

export function hasRecommendationShortlist(state) {
  return (state?.last_recommended_venue_ids?.length ?? 0) > 0
}

export function classifyConciergeFollowUp(message, state, options = {}) {
  const msg = (message || '').trim()
  const hasShortlist = hasRecommendationShortlist(state)
  const hasExchange = Boolean(options.hasPreviousExchange)

  if (!hasExchange || !hasShortlist) {
    return { mode: FOLLOW_UP_NEW_SEARCH, reason: 'no_prior_shortlist', scopeVenueIds: null, focusedVenueId: null }
  }

  if (NEW_SEARCH_SIGNALS.some((re) => re.test(msg))) {
    return { mode: FOLLOW_UP_NEW_SEARCH, reason: 'new_search_signal', scopeVenueIds: null, focusedVenueId: null }
  }

  const resolved = resolveFollowUpReferences(msg, state)

  if (COMPARISON_SIGNALS.some((re) => re.test(msg)) || resolved.comparisonVenueIds?.length >= 2) {
    return {
      mode: FOLLOW_UP_COMPARISON,
      reason: 'comparison',
      scopeVenueIds: resolved.comparisonVenueIds?.length
        ? resolved.comparisonVenueIds
        : state.last_recommended_venue_ids,
      focusedVenueId: null,
    }
  }

  if (
    SINGLE_VENUE_SIGNALS.some((re) => re.test(msg)) ||
    resolved.focusedVenueId != null ||
    resolved.venueNameMatch
  ) {
    const focusId =
      resolved.focusedVenueId ??
      (resolved.comparisonVenueIds?.length === 1 ? resolved.comparisonVenueIds[0] : null)
    return {
      mode: FOLLOW_UP_SINGLE_VENUE,
      reason: resolved.focusedVenueId != null ? 'resolved_venue' : 'single_venue_signal',
      scopeVenueIds: focusId != null ? [focusId] : state.last_recommended_venue_ids,
      focusedVenueId: focusId,
    }
  }

  if (RESULT_SET_REFINEMENT_SIGNALS.some((re) => re.test(msg))) {
    return {
      mode: FOLLOW_UP_RESULT_SET_REFINEMENT,
      reason: 'result_set_signal',
      scopeVenueIds: state.last_recommended_venue_ids,
      focusedVenueId: null,
    }
  }

  if (
    msg.length < 120 &&
    /\b(?:do they|does it|is it|are they|any of them|which one|who has|have they|serve|serves|offering|offer)\b/i.test(msg) &&
    !/\b(?:best|top)\s+\w+\s+(?:in|near|around)\b/i.test(msg)
  ) {
    return {
      mode: FOLLOW_UP_RESULT_SET_REFINEMENT,
      reason: 'implicit_set_question',
      scopeVenueIds: state.last_recommended_venue_ids,
      focusedVenueId: null,
    }
  }

  return { mode: FOLLOW_UP_NEW_SEARCH, reason: 'default_new_search', scopeVenueIds: null, focusedVenueId: null }
}

export function resolveFollowUpReferences(message, state) {
  const msg = norm(message)
  const ids = state.last_recommended_venue_ids || []
  const names = state.last_recommended_venue_names || []
  let focusedVenueId = null
  const comparisonVenueIds = []
  let venueNameMatch = false

  const ordinalMatch = msg.match(
    /\b(?:the\s+)?(first|1st|one|second|2nd|two|third|3rd|three|fourth|4th|four|fifth|5th|five|last)\s+(?:one|place|spot|venue|restaurant)?\b/
  )
  if (ordinalMatch) {
    const key = ordinalMatch[1]
    let idx = ORDINAL_INDEX[key]
    if (key === 'last') idx = ids.length - 1
    if (idx != null && idx >= 0 && idx < ids.length) focusedVenueId = ids[idx]
  }

  if (/\b(?:that|this)\s+(?:place|one|spot|venue|restaurant)\b/.test(msg) && state.currently_focused_venue_id != null) {
    focusedVenueId = state.currently_focused_venue_id
  }

  for (let i = 0; i < names.length; i++) {
    const name = names[i]
    if (!name) continue
    if (venueNameAppearsInText(message, name)) {
      venueNameMatch = true
      const id = ids[i]
      if (id != null) {
        comparisonVenueIds.push(id)
        if (focusedVenueId == null) focusedVenueId = id
      }
    }
  }

  return {
    focusedVenueId,
    comparisonVenueIds: [...new Set(comparisonVenueIds)],
    venueNameMatch,
  }
}

export function followUpConstrainsToShortlist(mode) {
  return (
    mode === FOLLOW_UP_RESULT_SET_REFINEMENT ||
    mode === FOLLOW_UP_SINGLE_VENUE ||
    mode === FOLLOW_UP_COMPARISON
  )
}
