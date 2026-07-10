import { DeviceEventEmitter } from 'react-native'

/** Fired after a user posts or updates a venue review (mirrors web `review-mutated`). */
export const REVIEW_MUTATED = 'review-mutated'

/**
 * @param {number | string} venueId
 */
export function emitReviewMutated(venueId) {
  if (venueId == null) return
  DeviceEventEmitter.emit(REVIEW_MUTATED, { venueId })
}

/**
 * @param {(payload: { venueId?: number | string }) => void} handler
 * @returns {() => void}
 */
export function subscribeReviewMutated(handler) {
  const sub = DeviceEventEmitter.addListener(REVIEW_MUTATED, handler)
  return () => sub.remove()
}
