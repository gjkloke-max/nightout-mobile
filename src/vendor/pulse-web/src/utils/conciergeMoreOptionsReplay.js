import { detectNeighborhoodIntent, stripNeighborhoodForRetrievalQuery } from './detectNeighborhoodIntent.js'
import { queryWithoutLocationFromText } from './conciergeLocationAnchor.js'

/** Short follow-up lines that are not usable as retrieval text. */
export const MORE_OPTIONS_EXACT_FOLLOWUP =
  /^(more|additional|other|another|different|more options|give me more|show me more|any others?|what else)\s*$/i

/** Bare more-options variants including "more upscale options". */
export const MORE_OPTIONS_LINE =
  /^(more|additional|other|another|different)(\s+\w+){0,3}\s*(options?|choices?|suggestions?|places?|spots?|ones?)?\s*$/i

function normalizeCarriedNeighborhood(raw) {
  const s = String(raw || '').trim()
  if (!s) return null
  return detectNeighborhoodIntent(s).detected || s.toUpperCase().replace(/\s+/g, ' ')
}

/**
 * Pick the richest retrieval string for a bare "more options" turn.
 * Prefers planner-normalized semantic_review_query over bare user replay ("steak" vs "steakhouse dinner").
 *
 * @param {string|null|undefined} userReplay — from pickLastSubstantiveUserQuery
 * @param {{ semantic_review_query?: string, standalone_context_summary?: string }|null|undefined} searchState
 * @returns {string|null}
 */
export function resolveMoreFollowUpSearchText(userReplay, searchState) {
  const candidates = [
    userReplay,
    searchState?.semantic_review_query,
    searchState?.standalone_context_summary,
  ]
    .map((s) => (typeof s === 'string' ? s.trim() : ''))
    .filter((s) => s.length >= 5 && !MORE_OPTIONS_EXACT_FOLLOWUP.test(s))

  if (candidates.length === 0) return null
  return candidates.sort((a, b) => b.length - a.length)[0]
}

/**
 * @param {Array<{ content?: string }>} userMessages — all user turns in order (excludes current)
 * @returns {string|null}
 */
export function pickLastSubstantiveUserQuery(userMessages) {
  if (!Array.isArray(userMessages) || userMessages.length < 1) return null
  for (let i = userMessages.length - 1; i >= 0; i--) {
    const c = (userMessages[i]?.content || '').trim()
    if (c.length >= 5 && !MORE_OPTIONS_EXACT_FOLLOWUP.test(c) && !MORE_OPTIONS_LINE.test(c)) return c
  }
  return null
}

/**
 * True when the string is empty, a bare more-options line, or only a location phrase.
 * @param {string|null|undefined} text
 */
export function isNonSubstantiveReviewQuery(text) {
  const t = (typeof text === 'string' ? text : '').trim()
  if (!t || t.length < 3) return true
  if (MORE_OPTIONS_EXACT_FOLLOWUP.test(t)) return true
  const withoutLoc = queryWithoutLocationFromText(t).trim()
  return !withoutLoc || withoutLoc.length < 3
}

/**
 * BM25 + embed strings for venue_review RRF. On more-options, carry the prior dish intent
 * (e.g. "best burger") instead of ranking reviews against "more options" or "in OLD TOWN".
 *
 * @param {object} params
 */
export function resolvePlannerReviewContextQueries(params) {
  const {
    searchMessage = '',
    embedForVector = '',
    hybridQueryText = '',
    isMoreFollowUp = false,
    mergedSearchState = null,
    recommendationState = null,
    userMessages = [],
    nhExplicitInSearchMessage = null,
  } = params

  let source = 'current_turn'
  let substantive = null

  if (isMoreFollowUp) {
    substantive =
      resolveMoreFollowUpSearchText(pickLastSubstantiveUserQuery(userMessages), mergedSearchState) ||
      (recommendationState?.last_search_intent || '').trim() ||
      (mergedSearchState?.semantic_review_query || '').trim() ||
      null
    if (substantive && !MORE_OPTIONS_EXACT_FOLLOWUP.test(substantive)) {
      source = 'follow_up_replay'
    } else {
      substantive = null
    }
  }

  const stripForReview = (text) => {
    const raw = (text || '').trim()
    if (!raw) return ''
    const withoutLoc = queryWithoutLocationFromText(raw).trim()
    if (withoutLoc && withoutLoc.length >= 3 && !isNonSubstantiveReviewQuery(withoutLoc)) {
      return withoutLoc
    }
    if (nhExplicitInSearchMessage) {
      const stripped = stripNeighborhoodForRetrievalQuery(raw, nhExplicitInSearchMessage).intentQuery.trim()
      if (stripped && stripped.length >= 3 && !isNonSubstantiveReviewQuery(stripped)) return stripped
    }
    return raw
  }

  if (substantive) {
    const stripped = stripForReview(substantive)
    const intentQuery =
      hybridQueryText && !isNonSubstantiveReviewQuery(hybridQueryText)
        ? hybridQueryText.trim()
        : stripped || substantive.trim()
    return {
      bm25Query: intentQuery,
      embedQuery: intentQuery,
      source,
      carried_from: substantive.trim(),
    }
  }

  const fallbackBm25 = (hybridQueryText || searchMessage || '').trim()
  let fallbackEmbed = (embedForVector || hybridQueryText || searchMessage || '').trim()
  if (isNonSubstantiveReviewQuery(fallbackEmbed)) {
    fallbackEmbed = fallbackBm25
  }
  return {
    bm25Query: fallbackBm25,
    embedQuery: fallbackEmbed,
    source,
    carried_from: null,
  }
}

/**
 * Restore named-area scope on bare "more options" when replay/planner text omits neighborhood.
 *
 * @param {object} params
 * @param {{ last_search_intent?: string|null, last_location?: string|null }|null|undefined} params.recommendationState
 * @param {Array<{ content?: string }>} [params.userMessages]
 * @param {{ active_neighborhood_name?: string|null }|null|undefined} [params.lastGeoContext]
 * @returns {string|null}
 */
export function resolveMoreFollowUpCarriedNeighborhood({
  recommendationState = null,
  userMessages = [],
  lastGeoContext = null,
} = {}) {
  const fromIntent = detectNeighborhoodIntent(recommendationState?.last_search_intent || '').detected
  if (fromIntent) return fromIntent

  const fromLastLocation = normalizeCarriedNeighborhood(recommendationState?.last_location)
  if (fromLastLocation) return fromLastLocation

  const fromGeoContext = normalizeCarriedNeighborhood(lastGeoContext?.active_neighborhood_name)
  if (fromGeoContext) return fromGeoContext

  for (let i = (userMessages || []).length - 1; i >= 0; i--) {
    const { detected } = detectNeighborhoodIntent((userMessages[i]?.content || '').trim())
    if (detected) return detected
  }
  return null
}
