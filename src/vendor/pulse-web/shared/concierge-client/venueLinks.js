import { GEO_MODE_EXPLICIT_NEIGHBORHOOD } from '../../src/utils/geoPolicy.js'
import {
  filterVenuesMentionedInText,
  firstIndexOfVenueNameInText,
  venueNameAppearsInText,
} from '../../src/utils/venueMentionInText.js'
import { analyzeConciergeTurnIntent } from './followUpIntent.js'
import { normalizeVenueId } from './ids.js'
import { collectIntroducedVenueIds } from './introducedVenues.js'

/**
 * Venue rows attached to prior assistant messages (for cross-turn inline links).
 * @param {Array<{ role?: string, venues?: Array }>} messages
 */
function collectAssistantVenueLinkRows(messages) {
  const byId = new Map()
  for (const m of messages || []) {
    if (m?.role !== 'assistant' || !Array.isArray(m.venues)) continue
    for (const v of m.venues) {
      const id = normalizeVenueId(v?.venueId ?? v?.venue_id)
      const name = (v?.name || v?.venue?.name || '').trim()
      if (id == null || !name) continue
      if (!byId.has(id)) {
        byId.set(id, {
          venue_id: id,
          venueId: id,
          name,
          trending_rank: v?.trending_rank ?? v?.venue?.trending_rank ?? null,
          similarity: v?.similarity ?? null,
        })
      }
    }
  }
  return [...byId.values()]
}

/**
 * @param {Array<object>} primary
 * @param {Array<object>} extra
 */
function mergeVenueLinkRows(primary, extra) {
  const byId = new Map()
  for (const v of [...(primary || []), ...(extra || [])]) {
    const id = normalizeVenueId(v?.venueId ?? v?.venue_id)
    const name = (v?.name || v?.venue?.name || '').trim()
    if (id == null || !name) continue
    if (!byId.has(id)) {
      byId.set(id, {
        venue_id: id,
        venueId: id,
        name,
        trending_rank: v?.trending_rank ?? v?.venue?.trending_rank ?? null,
        similarity: v?.similarity ?? null,
      })
    }
  }
  return [...byId.values()]
}

/**
 * @param {Array<{ venue_id?: unknown, rating10?: unknown, similarity?: number }>} reviews
 * @param {Array<{ venue_id?: unknown, name?: string, [key: string]: unknown }>} venues
 */
export function buildVenueInfoArrayFromReviews(reviews, venues) {
  /** @type {Record<number, { venueId: number, venue: object, reviewRatings: number[], similarity: number }>} */
  const venueRatings = {}

  for (const review of reviews || []) {
    if (!review?.venue_id) continue
    const rid = normalizeVenueId(review.venue_id)
    if (rid == null) continue
    const venue = (venues || []).find((v) => normalizeVenueId(v.venue_id) === rid)
    if (!venue) continue
    if (!venueRatings[rid]) {
      venueRatings[rid] = {
        venueId: rid,
        venue,
        reviewRatings: [],
        similarity: review.similarity || 0,
      }
    }
    if (review.rating10 != null) {
      venueRatings[rid].reviewRatings.push(parseFloat(String(review.rating10)))
    }
    if ((review.similarity || 0) > venueRatings[rid].similarity) {
      venueRatings[rid].similarity = review.similarity || 0
    }
  }

  return Object.values(venueRatings)
    .filter((data) => data.venue)
    .map((data) => {
      const avgRating =
        data.reviewRatings.length > 0
          ? data.reviewRatings.reduce((sum, r) => sum + r, 0) / data.reviewRatings.length
          : 0
      return {
        venueId: data.venueId,
        venue: data.venue,
        avgRating,
        reviewCount: data.reviewRatings.length,
        ratingCount: data.reviewRatings.length,
        similarity: data.similarity,
      }
    })
}

/**
 * @param {Array<object>} apiVenues
 */
export function mapApiVenuesToLinkRows(apiVenues) {
  return (apiVenues || [])
    .map((v) => ({
      venue_id: normalizeVenueId(v.venue_id),
      venueId: normalizeVenueId(v.venue_id),
      name: v.name,
      trending_rank: v.trending_rank ?? null,
      similarity: v.similarity ?? null,
    }))
    .filter((v) => v.venue_id != null && v.name)
}

/**
 * Core venue pick logic shared by web link rows and mobile tappable names.
 * @param {object} opts
 * @param {string} opts.userMessage
 * @param {Array<{ role: string, venues?: Array }>} opts.messages
 * @param {string} opts.responseText
 * @param {Array<object>} opts.apiVenues
 * @param {Array<object>} [opts.reviews]
 * @param {object|null} [opts.geoContext]
 * @param {number} [opts.requestedCount]
 */
export function pickConciergeLinkVenues({
  userMessage,
  messages,
  responseText,
  apiVenues = [],
  reviews = [],
  geoContext = null,
  requestedCount = 5,
}) {
  const linkRows = mapApiVenuesToLinkRows(apiVenues)
  const priorLinkRows = collectAssistantVenueLinkRows(messages)
  const linkPool = mergeVenueLinkRows(linkRows, priorLinkRows)
  const mentioned = filterVenuesMentionedInText(responseText, linkPool, (v) => v.name)
  if (mentioned.length > 0) return mentioned

  const turn = analyzeConciergeTurnIntent(messages, userMessage)
  if (!turn.shouldShowVenuesOnFollowUp) return []

  const introduced = new Set(collectIntroducedVenueIds(messages))
  const venueInfoArray = buildVenueInfoArrayFromReviews(reviews, apiVenues)

  let matched = []
  if (responseText && venueInfoArray.length > 0) {
    const recommendationLower = responseText.toLowerCase()
    const mentionedFromPool = venueInfoArray.filter((info) =>
      venueNameAppearsInText(responseText, info.venue?.name),
    )
    if (mentionedFromPool.length > 0) {
      const seen = new Set()
      matched = mentionedFromPool
        .filter((info) => {
          if (seen.has(info.venueId)) return false
          seen.add(info.venueId)
          return true
        })
        .sort((a, b) => {
          const indexA = firstIndexOfVenueNameInText(recommendationLower, a.venue.name)
          const indexB = firstIndexOfVenueNameInText(recommendationLower, b.venue.name)
          if (indexA === -1) return 1
          if (indexB === -1) return -1
          return indexA - indexB
        })
        .slice(0, requestedCount)
    }
  }

  if (matched.length === 0 && venueInfoArray.length > 0) {
    matched = [...venueInfoArray]
      .sort((a, b) => {
        if (b.similarity !== a.similarity) return b.similarity - a.similarity
        if (b.avgRating !== a.avgRating) return b.avgRating - a.avgRating
        return b.ratingCount - a.ratingCount
      })
      .filter((v) => !introduced.has(v.venueId))
      .slice(0, requestedCount)
  }

  if (
    geoContext?.mode === GEO_MODE_EXPLICIT_NEIGHBORHOOD &&
    venueInfoArray.length > 0 &&
    matched.length > 0
  ) {
    const allowed = new Set(venueInfoArray.map((v) => v.venueId))
    matched = matched.filter((v) => allowed.has(v.venueId))
  }

  return matched.map((info) => ({
    venue_id: info.venueId,
    venueId: info.venueId,
    name: info.venue?.name,
    trending_rank: info.venue?.trending_rank ?? null,
    similarity: info.similarity ?? null,
  }))
}
