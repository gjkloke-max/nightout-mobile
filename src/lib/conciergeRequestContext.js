/**
 * Re-exports from pulse web shared/concierge-client (canonical source in pulse/NightOut repo).
 * Metro resolves @pulse-web → ../pulse (staging) or ../NightOut (local dev). See metro.config.js.
 */
export {
  analyzeConciergeTurnIntent,
  applyConciergeResponseToSession,
  buildConciergeRequest,
  emptyConciergeClientSession,
  lastGeoContextFromSession,
  pickConciergeLinkVenues,
  priorSearchQueryFromSession,
  rehydrateConciergeSessionFromMessages,
  retrievalPoolVenueIdsFromSession,
} from '@pulse-web/shared/concierge-client/index.js'
