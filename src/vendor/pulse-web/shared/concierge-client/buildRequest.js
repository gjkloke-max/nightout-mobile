import {
  classifyConciergeFollowUp,
  followUpConstrainsToShortlist,
  followUpPreservesPriorVenues,
  normalizeRecommendationState,
  FOLLOW_UP_MORE_OPTIONS,
  FOLLOW_UP_MORE_OPTIONS_WITH_PREFERENCE,
} from '../../src/utils/conciergeConversationState.js'
import { analyzeConciergeTurnIntent } from './followUpIntent.js'
import { collectIntroducedVenueIds } from './introducedVenues.js'
import { parseRankedVenueBacklog } from '../../src/utils/rankedVenueBacklog.js'

/**
 * @param {object} opts
 * @param {string} opts.userMessage
 * @param {Array<{ role: string, content?: string, venues?: Array }>} opts.messages - thread before current assistant reply
 * @param {object|null} opts.userHome
 * @param {object|null} opts.conversationSearchState
 * @param {object|null} opts.recommendationState
 * @param {object|null} opts.lastGeoContext
 * @param {string|null|undefined} opts.priorSearchQuery
 * @param {number[]} [opts.extraIntroducedVenueIds]
 * @param {{ orderedIds: number[], servedCount: number }|null} [opts.rankedVenueBacklog]
 * @param {boolean} [opts.conciergeDebug]
 * @param {Array} [opts.conversationHistory] - defaults to messages mapped to role/content
 */
export function buildConciergeRequest({
  userMessage,
  messages,
  userHome = null,
  conversationSearchState = null,
  canonicalConversationState = null,
  recommendationState = null,
  lastGeoContext = null,
  priorSearchQuery = null,
  extraIntroducedVenueIds = [],
  rankedVenueBacklog = null,
  conciergeDebug = false,
  conversationHistory = null,
}) {
  const turn = analyzeConciergeTurnIntent(messages, userMessage)
  // classifyConciergeFollowUp is a client-side, pre-request BEST-EFFORT guess, not the authoritative
  // follow-up classification — the server's LLM conversation resolver (conversationQueryResolver.js)
  // reclassifies every turn and generally overrides this guess (see the exclude/shortlist
  // reconciliation in server/index.js, and searchStateFollowUpModeForTurnType). Its output still
  // matters here for two things the server does NOT independently reproduce: (1) it decides whether
  // to send body.excludeVenueIds at all before the resolver has run, and (2) when the resolver
  // returns exclude_previous_results=true but the client already sent a non-empty list, the server
  // keeps THIS list rather than substituting only the last turn's venues — so introducedIds (the
  // full conversation's shown-venue history) is preserved instead of narrowed. Do not expand this
  // classifier's role beyond feeding excludeVenueIds; new follow-up logic belongs in the resolver.
  const followUp = classifyConciergeFollowUp(userMessage, normalizeRecommendationState(recommendationState), {
    hasPreviousExchange: turn.hasPreviousExchange,
  })
  const introducedIds = collectIntroducedVenueIds(messages, extraIntroducedVenueIds)

  const shortlistFollowUp = followUpConstrainsToShortlist(followUp.mode)
  const preservesPriorVenues = followUpPreservesPriorVenues(followUp.mode)

  const normalizedUserMsg = userMessage.toLowerCase().replace(/\s+/g, ' ').trim()
  const normalizedPriorCtx = (priorSearchQuery || '').toLowerCase().replace(/\s+/g, ' ').trim()
  const duplicateSubstantiveSearch =
    normalizedUserMsg.length >= 8 &&
    normalizedPriorCtx.length >= 8 &&
    normalizedUserMsg === normalizedPriorCtx &&
    !turn.isTellMeMoreFollowUp

  const wantsFreshVenuePicks =
    followUp.mode === FOLLOW_UP_MORE_OPTIONS ||
    followUp.mode === FOLLOW_UP_MORE_OPTIONS_WITH_PREFERENCE ||
    (turn.wantsFreshVenuePicks && !shortlistFollowUp)

  const excludeVenueIds =
    !shortlistFollowUp &&
    !preservesPriorVenues &&
    introducedIds.length > 0 &&
    (wantsFreshVenuePicks || duplicateSubstantiveSearch)
      ? introducedIds
      : undefined

  /** @type {Record<string, unknown>} */
  const body = {
    message: userMessage,
    conversationHistory:
      conversationHistory ??
      (messages || []).map((m) => ({
        role: m.role,
        content: typeof m.content === 'string' ? m.content : '',
      })),
    userHome: userHome && typeof userHome === 'object'
      ? {
          homeNeighborhoodName: userHome.homeNeighborhoodName ?? null,
          lat: userHome.lat ?? null,
          lng: userHome.lng ?? null,
        }
      : null,
  }

  if (excludeVenueIds?.length) body.excludeVenueIds = excludeVenueIds
  const backlog = parseRankedVenueBacklog(rankedVenueBacklog)
  if (backlog) body.rankedVenueBacklog = backlog
  if (conciergeDebug) body.debug = true
  if (conversationSearchState && typeof conversationSearchState === 'object') {
    body.conversationSearchState = conversationSearchState
  }
  if (recommendationState && typeof recommendationState === 'object') {
    body.recommendationState = recommendationState
  }
  if (canonicalConversationState && typeof canonicalConversationState === 'object') {
    body.canonicalConversationState = canonicalConversationState
  }
  if (
    (turn.shouldShowVenuesOnFollowUp || turn.isTellMeMoreFollowUp) &&
    turn.passLastGeoContext &&
    lastGeoContext &&
    typeof lastGeoContext === 'object'
  ) {
    body.lastGeoContext = lastGeoContext
  }

  return { body, turn, excludeVenueIds, followUp }
}
