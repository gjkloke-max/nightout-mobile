import { sanitizeConciergeResponseToAllowedVenues } from '../../src/utils/conciergeResponseGrounding.js'

/**
 * @param {string} responseText
 * @param {Array<{ name?: string, venue_id?: unknown }>} apiVenues
 * @param {RegExp|null} [headingStripRe]
 */
export function postProcessConciergeResponseText(responseText, apiVenues, headingStripRe = null) {
  let text = String(responseText || '').trim()
  if (headingStripRe) {
    text = text.replace(headingStripRe, '').trim()
  }
  if (text && Array.isArray(apiVenues) && apiVenues.length > 0) {
    const grounded = sanitizeConciergeResponseToAllowedVenues(text, apiVenues)
    text = grounded.text
  }
  return text
}

export {
  classifyConciergeFollowUp,
  followUpConstrainsToShortlist,
  followUpPreservesPriorVenues,
  normalizeRecommendationState,
  FOLLOW_UP_NEW_SEARCH,
  FOLLOW_UP_MORE_OPTIONS,
  FOLLOW_UP_CONSTRAINT_REFINEMENT,
  FOLLOW_UP_MORE_OPTIONS_WITH_PREFERENCE,
  FOLLOW_UP_LOCATION_REFINEMENT,
  FOLLOW_UP_RESULT_SET_REFINEMENT,
  FOLLOW_UP_SINGLE_VENUE,
  FOLLOW_UP_COMPARISON,
} from '../../src/utils/conciergeConversationState.js'
export { analyzeConciergeTurnIntent } from './followUpIntent.js'
export { buildConciergeRequest } from './buildRequest.js'
export {
  applyConciergeResponseToSession,
  emptyConciergeClientSession,
  lastGeoContextFromSession,
  priorSearchQueryFromSession,
  rankedVenueBacklogFromSession,
  rehydrateConciergeSessionFromMessages,
} from './sessionState.js'
export {
  buildVenueInfoArrayFromReviews,
  mapApiVenuesToLinkRows,
  pickConciergeLinkVenues,
} from './venueLinks.js'
export {
  collectIntroducedVenueIds,
  collectRetrievalPoolVenueIds,
} from './introducedVenues.js'
export { normalizeVenueId } from './ids.js'
