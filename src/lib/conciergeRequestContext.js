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
  normalizeVenueId,
  pickConciergeLinkVenues,
  postProcessConciergeResponseText,
  priorSearchQueryFromSession,
  rankedVenueBacklogFromSession,
  rehydrateConciergeSessionFromMessages,
  createSseFullTextFeeder,
} from '@pulse-web/shared/concierge-client/index.js'
