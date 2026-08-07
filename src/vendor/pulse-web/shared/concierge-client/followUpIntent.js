/**
 * Concierge turn intent — single source for web + mobile follow-up rules.
 */

import { detectNeighborhoodIntent } from '../../src/utils/detectNeighborhoodIntent.js'

export const MORE_FOLLOWUP_EXACT =
  /^(more|additional|other|another|different|more options|give me more|show me more|any others?|what else)\s*$/i

/**
 * @param {Array<{ role: string }>} messages
 */
export function hasPreviousExchange(messages) {
  return (
    (messages || []).some((m) => m.role === 'user') &&
    (messages || []).some((m) => m.role === 'assistant')
  )
}

/**
 * @param {string} userMessage
 * @param {boolean} hasExchange
 */
export function analyzeTellMeMoreFollowUp(userMessage, hasExchange) {
  const tellMeMoreMatch = userMessage.match(
    /(?:tell me more about|more about|details about|info about|more details on|details on|info on)\s+(.+)/i,
  )
  return !!(
    tellMeMoreMatch &&
    hasExchange &&
    tellMeMoreMatch[1]?.trim().length >= 2
  )
}

/**
 * @param {string} userMessage
 */
export function asksForMoreOptions(userMessage) {
  return (
    /(do you have|any|got any|got more|have any|have more|any other|any more)\s*(more|additional|other|another)?\s*(suggestions?|options?|recommendations?|places?|venues?|restaurants?)?/i.test(
      userMessage,
    ) ||
    /^(tell me|what about|how about|can you|do they|does it|is it|are they|more|additional|give me more|show me more|follow|up|also|and|what|where|when|why|how|tell|explain|describe|other|another|different)\s/i.test(
      userMessage,
    ) ||
    MORE_FOLLOWUP_EXACT.test(userMessage.trim()) ||
    /\bnearby\s+(?:options?|choices?|suggestions?|recommendations?|places?|venues?|spots?)\b/i.test(userMessage) ||
    /\bwhat\s+are\s+some\b/i.test(userMessage) ||
    /\b(?:show|give)\s+me\s+(?:some\s+)?(?:more|nearby|other)\b/i.test(userMessage)
  )
}

/**
 * @param {string} userMessage
 */
export function isExplicitRecommendation(userMessage) {
  return (
    /(recommend|suggest|find|show|give me|looking for|need|want|where should|what.*restaurant|what.*place|what.*venue|more|additional|options|other|another)\s/i.test(
      userMessage,
    ) ||
    /\b(?:more|additional|other|another|nearby)\s+(?:options?|choices?|suggestions?|recommendations?|places?|venues?|spots?)\b/i.test(
      userMessage,
    ) ||
    /\b(?:options|choices|suggestions|recommendations)\s*[?.!]?\s*$/i.test(userMessage.trim())
  )
}

/**
 * @param {Array<{ role: string }>} messages
 * @param {string} userMessage
 */
export function analyzeConciergeTurnIntent(messages, userMessage) {
  const msg = String(userMessage || '').trim()
  const exchange = hasPreviousExchange(messages)
  const isTellMeMoreFollowUp = analyzeTellMeMoreFollowUp(msg, exchange)
  const moreOptions = asksForMoreOptions(msg)
  const explicitRec = isExplicitRecommendation(msg)
  const isFollowUp = exchange && (moreOptions || explicitRec)
  const shouldShowVenuesOnFollowUp =
    isFollowUp && (explicitRec || moreOptions) && !isTellMeMoreFollowUp
  const neighborhoodInCurrent = detectNeighborhoodIntent(msg).detected
  const passLastGeoContext =
    !neighborhoodInCurrent &&
    isFollowUp &&
    (explicitRec || moreOptions) &&
    !isTellMeMoreFollowUp
  const isMoreFollowUpExact = MORE_FOLLOWUP_EXACT.test(msg)
  const wantsFreshVenuePicks =
    isMoreFollowUpExact ||
    (exchange && moreOptions && !isTellMeMoreFollowUp && msg.length < 120)

  return {
    hasPreviousExchange: exchange,
    isTellMeMoreFollowUp,
    asksForMoreOptions: moreOptions,
    isExplicitRecommendation: explicitRec,
    isFollowUp,
    shouldShowVenuesOnFollowUp,
    passLastGeoContext,
    wantsFreshVenuePicks,
    neighborhoodInCurrent,
  }
}
