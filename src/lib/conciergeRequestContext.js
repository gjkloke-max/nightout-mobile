/**
 * Re-exports from shared/concierge-client, vendored from the pulse/NightOut web repo (see
 * src/vendor/pulse-web/README.md) since EAS cloud builds can't reach a sibling repo directory.
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
} from '../vendor/pulse-web/shared/concierge-client/index.js'
