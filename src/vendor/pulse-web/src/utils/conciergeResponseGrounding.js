/**
 * Post-process concierge prose before it's sent to the client.
 */

/**
 * Historically this stripped whole paragraphs that named a venue outside the search allowlist, to
 * avoid recommending something not in our data. Removed: the venue-name-to-card hyperlinking step
 * (src/utils/conciergeLinkUtils.js, shared/concierge-client/venueLinks.js) already only links
 * venues from the current search result set — an ungrounded mention in prose was never clickable,
 * so the destructive stripping bought no real safety. It did, however, regularly mangle otherwise
 * good responses (deleting whole paragraphs, sometimes all of them) and force an awkward templated
 * fallback sentence in their place. Now a pass-through; kept as a named step (rather than inlined at
 * call sites) in case future grounding logic belongs here.
 *
 * @param {string} response
 * @returns {{ text: string, stripped: string[] }}
 */
export function sanitizeConciergeResponseToAllowedVenues(response) {
  return { text: (response || '').trim(), stripped: [] }
}
