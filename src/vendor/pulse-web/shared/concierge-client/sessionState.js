import { buildRecommendationStateFromTurn } from '../../src/utils/conciergeConversationState.js'
import { parseRankedVenueBacklog } from '../../src/utils/rankedVenueBacklog.js'

/**
 * @typedef {object} ConciergeClientSession
 * @property {{ searchQuery: string|null, geoContext: object|null }|null} searchContext
 * @property {object|null} searchState
 * @property {object|null} recommendationState
 * @property {object|null} canonicalConversationState
 * @property {{ orderedIds: number[], servedCount: number }|null} rankedVenueBacklog
 */

/** @returns {ConciergeClientSession} */
export function emptyConciergeClientSession() {
  return {
    searchContext: null,
    searchState: null,
    recommendationState: null,
    canonicalConversationState: null,
    rankedVenueBacklog: null,
  }
}

/**
 * Apply /api/concierge response fields to client session refs.
 * @param {ConciergeClientSession} session
 * @param {object} params
 * @param {object} params.data - API response
 * @param {string} params.userMessage
 * @param {ReturnType<import('./followUpIntent.js').analyzeConciergeTurnIntent>} params.turn
 * @returns {ConciergeClientSession}
 */
export function applyConciergeResponseToSession(session, { data, userMessage, turn }) {
  const next = {
    searchContext: session?.searchContext ? { ...session.searchContext } : null,
    searchState: session?.searchState ?? null,
    recommendationState: session?.recommendationState ?? null,
    canonicalConversationState: session?.canonicalConversationState ?? null,
    rankedVenueBacklog: session?.rankedVenueBacklog ?? null,
  }

  if (data?.geoContext && typeof data.geoContext === 'object') {
    const priorQuery = next.searchContext?.searchQuery
    next.searchContext = {
      searchQuery:
        (turn.shouldShowVenuesOnFollowUp || turn.isTellMeMoreFollowUp) && priorQuery
          ? priorQuery
          : userMessage,
      geoContext: data.geoContext,
    }
  } else if (!turn.passLastGeoContext && next.searchContext) {
    next.searchContext = {
      ...next.searchContext,
      searchQuery: userMessage,
    }
  }

  if (data?.searchState && typeof data.searchState === 'object') {
    next.searchState = data.searchState
  }
  if (data?.recommendationState && typeof data.recommendationState === 'object') {
    next.recommendationState = data.recommendationState
  }
  if (data?.canonicalConversationState && typeof data.canonicalConversationState === 'object') {
    next.canonicalConversationState = data.canonicalConversationState
  }
  if (data?.rankedVenueBacklog) {
    next.rankedVenueBacklog = parseRankedVenueBacklog(data.rankedVenueBacklog)
  }

  return next
}

/**
 * Rebuild session from persisted chat messages (searchState is not in DB today).
 * @param {Array<{ role: string, venues?: Array, searchState?: object, recommendationState?: object, rankedVenueBacklog?: object }>} messages
 * @returns {ConciergeClientSession}
 */
export function rehydrateConciergeSessionFromMessages(messages) {
  const session = emptyConciergeClientSession()
  const list = messages || []
  const lastAssistant = [...list]
    .reverse()
    .find((m) => m.role === 'assistant' && Array.isArray(m.venues) && m.venues.length > 0)

  if (lastAssistant) {
    if (lastAssistant.recommendationState) {
      session.recommendationState = lastAssistant.recommendationState
    } else {
      session.recommendationState = buildRecommendationStateFromTurn({
        venueIdsOrdered: lastAssistant.venues.map((v) => v.venue_id ?? v.venueId).filter((id) => id != null),
        venueNamesOrdered: lastAssistant.venues.map((v) => v.name).filter(Boolean),
      })
    }
  }

  const lastAssistantSearch = [...list].reverse().find((m) => m.role === 'assistant' && m.searchState)
  if (lastAssistantSearch?.searchState) {
    session.searchState = lastAssistantSearch.searchState
  }

  const lastCanonical = [...list]
    .reverse()
    .find((m) => m.role === 'assistant' && m.canonicalConversationState)
  if (lastCanonical?.canonicalConversationState) {
    session.canonicalConversationState = lastCanonical.canonicalConversationState
  }

  const lastWithBacklog = [...list].reverse().find((m) => m.role === 'assistant' && m.rankedVenueBacklog)
  if (lastWithBacklog?.rankedVenueBacklog) {
    session.rankedVenueBacklog = parseRankedVenueBacklog(lastWithBacklog.rankedVenueBacklog)
  }

  return session
}

/**
 * @param {ConciergeClientSession} session
 */
export function priorSearchQueryFromSession(session) {
  return session?.searchContext?.searchQuery ?? null
}

/**
 * @param {ConciergeClientSession} session
 */
export function lastGeoContextFromSession(session) {
  return session?.searchContext?.geoContext ?? null
}

/**
 * @param {ConciergeClientSession} session
 * @returns {{ orderedIds: number[], servedCount: number }|null}
 */
export function rankedVenueBacklogFromSession(session) {
  return parseRankedVenueBacklog(session?.rankedVenueBacklog)
}
