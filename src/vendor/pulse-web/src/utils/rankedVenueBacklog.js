/**
 * Ranked venue queue for "more options" — serve unseen Turn-1 matches before re-searching.
 */

/** @param {unknown} id */
export function normalizeBacklogVenueId(id) {
  if (id == null) return null
  const n = parseInt(String(id), 10)
  return Number.isFinite(n) ? n : null
}

/**
 * Unique venue ids in review ranking order (first appearance wins).
 * @param {Array<{ venue_id?: unknown }>} reviews
 * @returns {number[]}
 */
export function buildRankedVenueOrderFromReviews(reviews) {
  const seen = new Set()
  const out = []
  for (const r of reviews || []) {
    const id = normalizeBacklogVenueId(r?.venue_id)
    if (id == null || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

/**
 * Index after the highest-ranked shown venue (legacy cursor hint).
 * @param {number[]} orderedIds
 * @param {number[]} shownVenueIds
 */
export function computeServedCount(orderedIds, shownVenueIds) {
  let maxIdx = 0
  for (const raw of shownVenueIds || []) {
    const id = normalizeBacklogVenueId(raw)
    if (id == null) continue
    const idx = orderedIds.indexOf(id)
    if (idx >= 0) maxIdx = Math.max(maxIdx, idx + 1)
  }
  return maxIdx
}

/**
 * @param {unknown} raw
 * @returns {{ orderedIds: number[], servedCount: number } | null}
 */
export function parseRankedVenueBacklog(raw) {
  if (!raw || typeof raw !== 'object') return null
  const list = Array.isArray(raw.orderedIds) ? raw.orderedIds : []
  const orderedIds = [
    ...new Set(list.map(normalizeBacklogVenueId).filter((id) => id != null)),
  ]
  if (orderedIds.length === 0) return null
  const servedRaw = raw.servedCount
  const servedCount =
    typeof servedRaw === 'number' && Number.isFinite(servedRaw) && servedRaw >= 0
      ? Math.min(Math.floor(servedRaw), orderedIds.length)
      : 0
  return { orderedIds, servedCount }
}

/**
 * Count backlog venues not yet introduced to the user.
 * @param {number[]} orderedIds
 * @param {Set<number>} introducedSet
 */
export function countUnintroducedBacklogVenues(orderedIds, introducedSet) {
  let n = 0
  for (const id of orderedIds || []) {
    if (!introducedSet.has(id)) n++
  }
  return n
}

/**
 * Next batch of ordered ids to fetch — skips introduced and already-fetched ids.
 * @param {number[]} orderedIds
 * @param {{ introducedSet?: Set<number>, fetchedSet?: Set<number>, batchSize?: number }} [options]
 */
export function nextBacklogFetchBatch(orderedIds, options = {}) {
  const introducedSet = options.introducedSet || new Set()
  const fetchedSet = options.fetchedSet || new Set()
  const batchSize = Math.max(1, options.batchSize ?? 5)
  const out = []
  for (const id of orderedIds || []) {
    if (introducedSet.has(id) || fetchedSet.has(id)) continue
    out.push(id)
    if (out.length >= batchSize) break
  }
  return out
}

/**
 * Pop the next slice from the ranked backlog — first N ordered ids not yet introduced.
 * @param {{ orderedIds: number[], servedCount?: number }} backlog
 * @param {{ introducedSet?: Set<number>, sliceSize?: number, minSlice?: number }} [options]
 */
export function popNextBacklogVenueIds(backlog, options = {}) {
  const ordered = backlog?.orderedIds || []
  const introducedSet = options.introducedSet || new Set()
  const sliceSize = Math.max(1, options.sliceSize ?? 5)
  const minSlice = Math.max(1, options.minSlice ?? 3)
  const nextIds = []

  for (const id of ordered) {
    if (introducedSet.has(id)) continue
    nextIds.push(id)
    if (nextIds.length >= sliceSize) break
  }

  const consumed = new Set(introducedSet)
  for (const id of nextIds) consumed.add(id)
  const newServedCount = computeServedCount(ordered, [...consumed])

  const remaining = ordered.filter((id) => !consumed.has(id)).length

  return {
    nextIds,
    newServedCount,
    hasEnough: nextIds.length >= minSlice,
    remainingAfterCursor: remaining,
  }
}

/**
 * Append newly discovered ranked ids (search fallback when backlog is thin).
 * @param {{ orderedIds: number[], servedCount: number } | null} existing
 * @param {number[]} newOrder
 * @param {number[]} shownVenueIds
 */
export function mergeRankedVenueBacklog(existing, newOrder, shownVenueIds) {
  const base = existing?.orderedIds?.length ? [...existing.orderedIds] : []
  const seen = new Set(base)
  for (const raw of newOrder || []) {
    const id = normalizeBacklogVenueId(raw)
    if (id == null || seen.has(id)) continue
    seen.add(id)
    base.push(id)
  }
  const servedCount = computeServedCount(base, shownVenueIds)
  return { orderedIds: base, servedCount }
}

/**
 * @param {number[]} orderedIds
 * @param {number} count
 */
export function similarityScoresForBacklogOrder(orderedIds, count = orderedIds.length) {
  const map = new Map()
  const denom = Math.max(1, count)
  orderedIds.forEach((id, idx) => {
    map.set(id, Math.max(0.35, 1 - idx / denom))
  })
  return map
}
