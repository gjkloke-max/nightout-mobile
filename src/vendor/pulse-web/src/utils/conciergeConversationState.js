/**
 * Structured concierge recommendation memory and follow-up resolution.
 *
 * Modes:
 * - new_search — fresh retrieval (explicit topic change)
 * - more_options — same intent/location, exclude prior venues
 * - constraint_refinement — add preference, keep prior venues eligible
 * - result_set_refinement — question about the current shortlist only
 * - more_options_with_new_preference — more options + new preference
 * - location_refinement — add/change location while preserving dish/intent
 * - single_venue_followup — one venue from the shortlist
 * - comparison_followup — compare/rank venues in the shortlist
 */

import { detectNeighborhoodIntent } from './detectNeighborhoodIntent.js'
import { venueNameAppearsInText } from './venueMentionInText.js'
import { MORE_OPTIONS_EXACT_FOLLOWUP } from './conciergeMoreOptionsReplay.js'

export const FOLLOW_UP_NEW_SEARCH = 'new_search'
export const FOLLOW_UP_MORE_OPTIONS = 'more_options'
export const FOLLOW_UP_CONSTRAINT_REFINEMENT = 'constraint_refinement'
export const FOLLOW_UP_MORE_OPTIONS_WITH_PREFERENCE = 'more_options_with_new_preference'
export const FOLLOW_UP_LOCATION_REFINEMENT = 'location_refinement'
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
  /\bgive\s+me\s+(?:some\s+)?(?:new|different|other)\s+(?:options?|places?|venues?|restaurants?)\b/i,
]

const MORE_OPTIONS_WITH_PREFERENCE_RE =
  /\b(?:more|additional|other|another)\s+(?:options?|choices?|places?|venues?)\b.*\b(?:but|with|would like|prefer|ideally|maybe|also)\b/i

const CONSTRAINT_REFINEMENT_RE = [
  /\b(?:any|some)\s+(?:gluten[\s-]?free|vegan|vegetarian|dairy[\s-]?free|byob|dog[\s-]?friendly|outdoor|patio|cheaper|quieter|reservations?)\b/i,
  /\b(?:with|also)\s+(?:good|great)\s+(?:coffee|sides?|dessert|cocktails?)\b/i,
  /\b(?:also\s+)?have\s+(?:good|great)\s+(?:coffee|sides?|dessert|cocktails?)\b/i,
  /\bwhat\s+about\s+(?:places?|spots?|venues?|options?)\s+that\s+also\b/i,
  /\b(?:gluten[\s-]?free|vegan|vegetarian|dairy[\s-]?free|byob|dog[\s-]?friendly)\??\s*$/i,
]

const LOCATION_REFINEMENT_RE = [
  /\b(?:any|some)\s+(?:options?|places?|venues?|restaurants?)\s+(?:in|near|around)\b/i,
  /\b(?:what|how)\s+about\s+(?:in\s+)?\w/i,
  /\bin\s+[a-z][\w\s]{2,30}\??\s*$/i,
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
    last_normalized_search_query: null,
    last_location: null,
    last_near_me_resolution: null,
    last_cuisine: null,
    last_place_type: null,
    last_format: null,
    last_dietary: null,
    last_vibe: null,
    last_hard_filters: [],
    last_soft_boosts: [],
    last_bonus_boosts: [],
    last_allowed_venue_ids: [],
    last_ranked_backlog: null,
    currently_focused_venue_id: null,
    // Purely-accumulating history of venues recommended earlier in the conversation, distinct from
    // last_recommended_venue_ids (the current focus/shortlist, which narrows on single-venue turns).
    // Lets a later challenge ("why are you recommending these") still access review evidence for
    // venues that fell out of the narrow shortlist, instead of only ever seeing the one just-focused
    // venue. See server/index.js's shortlistFollowUp accumulation logic for how this is populated.
    prior_shortlist_venue_ids: [],
    prior_shortlist_venue_names: [],
  }
}

/**
 * @param {unknown} raw
 * @returns {ReturnType<typeof emptyRecommendationState>}
 */
export function normalizeRecommendationState(raw) {
  const base = emptyRecommendationState()
  if (!raw || typeof raw !== 'object') return base
  const ids = Array.isArray(raw.last_recommended_venue_ids)
    ? raw.last_recommended_venue_ids.map((id) => parseInt(String(id), 10)).filter((n) => !isNaN(n))
    : []
  const names = Array.isArray(raw.last_recommended_venue_names)
    ? raw.last_recommended_venue_names.map((n) => String(n || '').trim()).filter(Boolean)
    : []
  const priorShortlistIds = Array.isArray(raw.prior_shortlist_venue_ids)
    ? raw.prior_shortlist_venue_ids.map((id) => parseInt(String(id), 10)).filter((n) => !isNaN(n))
    : []
  const priorShortlistNames = Array.isArray(raw.prior_shortlist_venue_names)
    ? raw.prior_shortlist_venue_names.map((n) => String(n || '').trim()).filter(Boolean)
    : []
  return {
    ...base,
    last_recommended_venue_ids: ids,
    last_recommended_venue_names: names,
    prior_shortlist_venue_ids: priorShortlistIds,
    prior_shortlist_venue_names: priorShortlistNames,
    last_result_order: Array.isArray(raw.last_result_order)
      ? raw.last_result_order.map((id) => parseInt(String(id), 10)).filter((n) => !isNaN(n))
      : ids,
    last_search_intent: raw.last_search_intent != null ? String(raw.last_search_intent) : null,
    last_normalized_search_query:
      raw.last_normalized_search_query != null ? String(raw.last_normalized_search_query) : null,
    last_location: raw.last_location != null ? String(raw.last_location) : null,
    last_near_me_resolution:
      raw.last_near_me_resolution != null ? String(raw.last_near_me_resolution) : null,
    last_hard_filters: Array.isArray(raw.last_hard_filters) ? raw.last_hard_filters : [],
    last_soft_boosts: Array.isArray(raw.last_soft_boosts) ? raw.last_soft_boosts : [],
    last_bonus_boosts: Array.isArray(raw.last_bonus_boosts) ? raw.last_bonus_boosts : [],
    last_allowed_venue_ids: Array.isArray(raw.last_allowed_venue_ids)
      ? raw.last_allowed_venue_ids.map((id) => parseInt(String(id), 10)).filter((n) => !isNaN(n))
      : [],
    last_ranked_backlog: raw.last_ranked_backlog ?? null,
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

/**
 * @param {object} params
 * @param {number[]} params.venueIdsOrdered
 * @param {string[]} params.venueNamesOrdered
 * @param {string} [params.searchMessage]
 * @param {object} [params.mergedSearchState]
 * @param {number|null} [params.focusedVenueId]
 * @param {number[]} [params.priorShortlistVenueIds]
 * @param {string[]} [params.priorShortlistVenueNames]
 */
export function buildRecommendationStateFromTurn({
  venueIdsOrdered,
  venueNamesOrdered,
  searchMessage,
  mergedSearchState,
  focusedVenueId,
  allowedVenueIds,
  rankedBacklog,
  plannerIntent,
  priorShortlistVenueIds,
  priorShortlistVenueNames,
}) {
  const ids = (venueIdsOrdered || []).map((id) => parseInt(String(id), 10)).filter((n) => !isNaN(n))
  const names = (venueNamesOrdered || []).map((n) => String(n || '').trim()).filter(Boolean)
  const priorIds = (priorShortlistVenueIds || []).map((id) => parseInt(String(id), 10)).filter((n) => !isNaN(n))
  const priorNames = (priorShortlistVenueNames || []).map((n) => String(n || '').trim()).filter(Boolean)
  const { detected: location } = detectNeighborhoodIntent(searchMessage || '')
  const nearMeResolved =
    mergedSearchState?.location_mode === 'near_me'
      ? mergedSearchState?.resolved_neighborhoods?.[0] || location
      : null
  return {
    version: 1,
    last_recommended_venue_ids: ids,
    last_recommended_venue_names: names,
    last_result_order: ids,
    last_search_intent: searchMessage?.trim() || null,
    last_normalized_search_query:
      plannerIntent?.normalized_search_query ||
      mergedSearchState?.semantic_review_query ||
      searchMessage?.trim() ||
      null,
    last_location:
      location ||
      mergedSearchState?.resolved_neighborhoods?.[0] ||
      mergedSearchState?.raw_location_text ||
      null,
    last_near_me_resolution: nearMeResolved,
    last_cuisine: mergedSearchState?.cuisine?.[0] || mergedSearchState?.hard_filters_cuisine?.[0] || null,
    last_place_type: mergedSearchState?.hard_filters_place_type?.[0] || null,
    last_format: mergedSearchState?.hard_filters_food_service?.[0] || null,
    last_dietary: mergedSearchState?.hard_filters_dietary?.[0] || mergedSearchState?.dietary_constraints?.[0] || null,
    last_vibe: mergedSearchState?.vibe?.[0] || null,
    last_hard_filters: plannerIntent?.hard_filters || mergedSearchState?.hard_constraints || [],
    last_soft_boosts: plannerIntent?.soft_boosts || mergedSearchState?.soft_preferences || [],
    last_bonus_boosts: plannerIntent?.bonus_boosts || [],
    last_allowed_venue_ids: (allowedVenueIds || ids).map((id) => parseInt(String(id), 10)).filter((n) => !isNaN(n)),
    last_ranked_backlog: rankedBacklog ?? null,
    currently_focused_venue_id: focusedVenueId ?? null,
    prior_shortlist_venue_ids: priorIds,
    prior_shortlist_venue_names: priorNames,
  }
}

/**
 * @param {string} message
 * @param {ReturnType<typeof emptyRecommendationState>} state
 * @param {{ hasPreviousExchange?: boolean }} [options]
 */
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

  if (MORE_OPTIONS_WITH_PREFERENCE_RE.test(msg)) {
    return {
      mode: FOLLOW_UP_MORE_OPTIONS_WITH_PREFERENCE,
      reason: 'more_options_with_preference',
      scopeVenueIds: null,
      focusedVenueId: null,
    }
  }

  if (MORE_OPTIONS_EXACT_FOLLOWUP.test(msg)) {
    return { mode: FOLLOW_UP_MORE_OPTIONS, reason: 'more_options_exact', scopeVenueIds: null, focusedVenueId: null }
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

  if (RESULT_SET_REFINEMENT_SIGNALS.some((re) => re.test(msg))) {
    return {
      mode: FOLLOW_UP_RESULT_SET_REFINEMENT,
      reason: 'result_set_signal',
      scopeVenueIds: state.last_recommended_venue_ids,
      focusedVenueId: null,
    }
  }

  const neighborhoodInMsg = detectNeighborhoodIntent(msg).detected
  if (
    neighborhoodInMsg &&
    msg.length < 100 &&
    (LOCATION_REFINEMENT_RE.some((re) => re.test(msg)) || !/\b(?:best|top)\s+\w+\s+(?:in|near)\b/i.test(msg))
  ) {
    return {
      mode: FOLLOW_UP_LOCATION_REFINEMENT,
      reason: 'location_refinement',
      scopeVenueIds: null,
      focusedVenueId: null,
    }
  }

  if (
    SINGLE_VENUE_SIGNALS.some((re) => re.test(msg)) ||
    (resolved.focusedVenueId != null && !MORE_OPTIONS_WITH_PREFERENCE_RE.test(msg)) ||
    (resolved.venueNameMatch && !MORE_OPTIONS_WITH_PREFERENCE_RE.test(msg))
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

  if (
    msg.length < 120 &&
    (CONSTRAINT_REFINEMENT_RE.some((re) => re.test(msg)) ||
      /\b(?:do they|does it|is it|are they|any of them|which one|who has|have they|serve|serves|offering|offer)\b/i.test(msg)) &&
    !/\b(?:best|top)\s+\w+\s+(?:in|near|around)\b/i.test(msg)
  ) {
    return {
      mode: FOLLOW_UP_CONSTRAINT_REFINEMENT,
      reason: 'constraint_refinement',
      scopeVenueIds: null,
      focusedVenueId: null,
    }
  }

  return { mode: FOLLOW_UP_NEW_SEARCH, reason: 'default_new_search', scopeVenueIds: null, focusedVenueId: null }
}

/**
 * @param {string} message
 * @param {ReturnType<typeof emptyRecommendationState>} state
 */
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

  const uniqueComparison = [...new Set(comparisonVenueIds)]

  return {
    focusedVenueId,
    comparisonVenueIds: uniqueComparison,
    venueNameMatch,
  }
}

/** Strip conversational wrappers so "do either of these places serve wings" → "wings". */
const REFINEMENT_STRIP_PREFIX = [
  /^(?:how|what)\s+about\s+(?:a|an|the|some)?\s*/i,
  /^(?:do|does|did|can|could|will|would)\s+(?:any|either|both|neither)\s+(?:of\s+)?(?:those|them|these|the)?\s*(?:(?:two|2|three|3|four|4)\s+)?(?:places?|venues?|restaurants?|spots?)\s+/i,
  /^(?:do|does|did)\s+(?:they|them)\s+/i,
  /^(?:which|what)\s+of\s+(?:those|them|these)\s+/i,
  /^(?:is|are)\s+(?:either|both|either of|any of)\s+(?:of\s+)?(?:those|them|these)\s+/i,
]

const REFINEMENT_STRIP_SUFFIX = [
  /\s+(?:at|from)\s+(?:those|them|these)\s*(?:places?|venues?)?\s*$/i,
  /\s+on\s+(?:their|the)\s+menu\s*$/i,
]

/**
 * Extract the new criterion from a shortlist follow-up (food, amenity, vibe, etc.).
 * @param {string} message
 * @returns {string}
 */
export function extractRefinementCriteria(message) {
  let q = (message || '').trim().replace(/\?+$/, '').trim()
  for (const re of REFINEMENT_STRIP_PREFIX) {
    q = q.replace(re, '')
  }
  for (const re of REFINEMENT_STRIP_SUFFIX) {
    q = q.replace(re, '')
  }
  q = q
    .replace(/\b(?:serve|serves|serving|offer|offers|offering|have|has|had|get|gets)\b/gi, ' ')
    .replace(/\b(?:too|also|as well)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return q
}

/**
 * Build hybrid retrieval text: new follow-up criteria + prior search intent.
 * @param {string} userMessage
 * @param {ReturnType<typeof emptyRecommendationState>} recommendationState
 * @param {string} [followUpMode]
 */
export function buildShortlistRetrievalQuery(userMessage, recommendationState, followUpMode) {
  const prior =
    (recommendationState?.last_normalized_search_query || recommendationState?.last_search_intent || '').trim()
  const criteria = extractRefinementCriteria(userMessage)

  if (followUpMode === FOLLOW_UP_COMPARISON && !criteria) {
    return prior || userMessage.trim()
  }

  if (followUpMode === FOLLOW_UP_LOCATION_REFINEMENT) {
    const { detected, queryWithoutNeighborhood } = detectNeighborhoodIntent(userMessage)
    const loc = detected ? detected.toLowerCase().replace(/_/g, ' ') : ''
    const base = prior || (queryWithoutNeighborhood || userMessage).trim()
    return loc ? `${base} ${loc}`.trim() : base
  }

  const parts = []
  if (criteria.length >= 2) parts.push(criteria)
  if (prior) parts.push(prior)

  const merged = parts.join(' ').replace(/\s+/g, ' ').trim()
  return merged || userMessage.trim()
}

/**
 * Build retrieval query for constraint/location refinements preserving prior intent.
 */
export function buildConstraintRefinementRetrievalQuery(userMessage, recommendationState) {
  const prior =
    (recommendationState?.last_normalized_search_query || recommendationState?.last_search_intent || '').trim()
  const criteria = extractRefinementCriteria(userMessage)
  if (criteria.length >= 2 && prior) return `${prior} ${criteria}`.trim()
  if (prior) return prior
  return userMessage.trim()
}

/**
 * @param {string} mode
 */
export function followUpConstrainsToShortlist(mode) {
  return (
    mode === FOLLOW_UP_RESULT_SET_REFINEMENT ||
    mode === FOLLOW_UP_SINGLE_VENUE ||
    mode === FOLLOW_UP_COMPARISON
  )
}

/**
 * Follow-up modes that refine the prior search without excluding already-shown venues.
 * @param {string} mode
 */
export function followUpPreservesPriorVenues(mode) {
  return (
    mode === FOLLOW_UP_CONSTRAINT_REFINEMENT ||
    mode === FOLLOW_UP_LOCATION_REFINEMENT
  )
}

/**
 * System prompt block for shortlist-scoped turns.
 */
export function buildShortlistFollowUpPrompt({
  mode,
  venueNames,
  userMessage,
  priorSearchIntent,
  retrievalQuery,
}) {
  const list = (venueNames || []).filter(Boolean).join(', ')
  const base = `CONVERSATION CONTEXT: You are answering a follow-up about venues already recommended in this chat. You may ONLY discuss these venues: ${list || 'none'}. Do NOT introduce or recommend new restaurants unless the user explicitly asks for new options or none of these can answer the question.

Prior search topic: ${priorSearchIntent || 'dining recommendations'}.
User follow-up: ${userMessage}
Review evidence in context was retrieved for: ${retrievalQuery || userMessage}.`

  if (mode === FOLLOW_UP_RESULT_SET_REFINEMENT) {
    return `${base}

TASK: Answer whether / which of the listed venues match the follow-up criterion using review excerpts below. If reviews mention the criterion (e.g. wings, patio, reservations), say which venues have it. If no review mentions it, say you do not see evidence—not that you know the full menu. Only then offer to search for new wing-focused places if they want.`
  }
  if (mode === FOLLOW_UP_SINGLE_VENUE) {
    return `${base}

TASK: Answer primarily about the one venue the user is asking about. Do not pivot to brand-new venues not already discussed. If the user is questioning or challenging a venue you previously recommended, evaluate it honestly using the review evidence below - say plainly if it doesn't hold up. If earlier in this conversation you also recommended other venues for the same ask and their own review evidence is present below, you may reference them individually - do not retract them just because this one venue didn't pan out. Only say none of the venues fit if the evidence for ALL of them actually fails to support the ask.`
  }
  if (mode === FOLLOW_UP_COMPARISON) {
    return `${base}

TASK: Compare or rank only among the listed venues using review evidence. Do not add new venues.`
  }
  return base
}
