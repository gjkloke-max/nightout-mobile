/**
 * Concierge request helpers — keep in sync with NightOut web ChatConcierge.jsx.
 */

const MORE_FOLLOWUP_EXACT =
  /^(more|additional|other|another|different|more options|give me more|show me more|any others?|what else)\s*$/i

/**
 * @param {Array<{ role: string, content?: string, venues?: Array }>} messages - Full thread including current user turn
 * @param {string} userMessage
 * @param {string | null | undefined} priorSearchQuery - From last geo/search context
 */
export function buildConciergeExcludeVenueIds(messages, userMessage, priorSearchQuery) {
  const introducedIds = []
  for (const m of messages || []) {
    if (m.role !== 'assistant' || !Array.isArray(m.venues)) continue
    for (const v of m.venues) {
      const vid = v?.venue_id ?? v?.venueId
      if (vid != null && !introducedIds.includes(vid)) introducedIds.push(vid)
    }
  }
  if (introducedIds.length === 0) return []

  const hasPreviousExchange =
    (messages || []).some((m) => m.role === 'user') && (messages || []).some((m) => m.role === 'assistant')
  const tellMeMoreMatch = userMessage.match(
    /(?:tell me more about|more about|details about|info about|more details on|details on|info on)\s+(.+)/i
  )
  const isTellMeMoreFollowUp = !!(
    tellMeMoreMatch &&
    hasPreviousExchange &&
    tellMeMoreMatch[1]?.trim().length >= 2
  )
  const asksForMoreOptions =
    /(do you have|any|got any|got more|have any|have more|any other|any more)\s*(more|additional|other|another)?\s*(suggestions?|options?|recommendations?|places?|venues?|restaurants?)?/i.test(
      userMessage
    ) ||
    /^(tell me|what about|how about|can you|do they|does it|is it|are they|more|additional|give me more|show me more|follow|up|also|and|what|where|when|why|how|tell|explain|describe|other|another|different)\s/i.test(
      userMessage
    ) ||
    MORE_FOLLOWUP_EXACT.test(userMessage.trim()) ||
    /\bnearby\s+(?:options?|choices?|suggestions?|recommendations?|places?|venues?|spots?)\b/i.test(userMessage) ||
    /\bwhat\s+are\s+some\b/i.test(userMessage) ||
    /\b(?:show|give)\s+me\s+(?:some\s+)?(?:more|nearby|other)\b/i.test(userMessage)

  const wantsFreshVenuePicks =
    MORE_FOLLOWUP_EXACT.test(userMessage.trim()) ||
    (hasPreviousExchange && asksForMoreOptions && !isTellMeMoreFollowUp && userMessage.trim().length < 120)

  const normalizedUserMsg = userMessage.toLowerCase().replace(/\s+/g, ' ').trim()
  const normalizedPriorCtx = (priorSearchQuery || '').toLowerCase().replace(/\s+/g, ' ').trim()
  const duplicateSubstantiveSearch =
    normalizedUserMsg.length >= 8 &&
    normalizedPriorCtx.length >= 8 &&
    normalizedUserMsg === normalizedPriorCtx &&
    !isTellMeMoreFollowUp

  if (wantsFreshVenuePicks || duplicateSubstantiveSearch) return introducedIds
  return []
}

/**
 * @param {Array<{ role: string }>} messages
 * @param {string} userMessage
 */
export function shouldPassLastGeoContext(messages, userMessage) {
  const hasPreviousExchange =
    (messages || []).some((m) => m.role === 'user') && (messages || []).some((m) => m.role === 'assistant')
  const tellMeMoreMatch = userMessage.match(
    /(?:tell me more about|more about|details about|info about|more details on|details on|info on)\s+(.+)/i
  )
  const isTellMeMoreFollowUp = !!(
    tellMeMoreMatch &&
    hasPreviousExchange &&
    tellMeMoreMatch[1]?.trim().length >= 2
  )
  const isExplicitRecommendation =
    /(recommend|suggest|find|show|give me|looking for|need|want|where should|what.*restaurant|what.*place|what.*venue|more|additional|options|other|another)\s/i.test(
      userMessage
    ) ||
    /\b(?:more|additional|other|another|nearby)\s+(?:options?|choices?|suggestions?|recommendations?|places?|venues?|spots?)\b/i.test(
      userMessage
    ) ||
    /\b(?:options|choices|suggestions|recommendations)\s*[?.!]?\s*$/i.test(userMessage.trim())
  const asksForMoreOptions =
    /(do you have|any|got any|got more|have any|have more|any other|any more)\s*(more|additional|other|another)?\s*(suggestions?|options?|recommendations?|places?|venues?|restaurants?)?/i.test(
      userMessage
    ) ||
    MORE_FOLLOWUP_EXACT.test(userMessage.trim()) ||
    /\bnearby\s+(?:options?|choices?|suggestions?|recommendations?|places?|venues?|spots?)\b/i.test(userMessage)

  const isFollowUp = hasPreviousExchange && (asksForMoreOptions || isExplicitRecommendation)
  return isFollowUp && (isExplicitRecommendation || asksForMoreOptions) && !isTellMeMoreFollowUp
}
