/**
 * Thumbs up/down on a concierge answer (web + mobile). The server gives each answer a `trace_id`;
 * the apps send it back with the rating to POST /api/concierge/feedback.
 */

/** The one-tap reasons offered on a thumbs down. The ids are what the server stores. */
export const CONCIERGE_FEEDBACK_REASONS = [
  { id: 'wrong_kind', label: 'Wrong kind of place' },
  { id: 'wrong_area', label: 'Wrong area' },
  { id: 'not_good', label: 'Not good suggestions' },
]

export const CONCIERGE_FEEDBACK_NOTE_MAX = 1000

/**
 * @param {object} p
 * @param {string} p.traceId  `trace_id` from the concierge reply
 * @param {'up'|'down'} p.rating
 * @param {string|null} [p.reason]  one of CONCIERGE_FEEDBACK_REASONS ids; ignored on a thumbs up
 * @param {string} [p.note]
 * @returns {{ trace_id: string, rating: 'up'|'down', reason?: string, note?: string }|null} null when there is nothing valid to send
 */
export function buildConciergeFeedbackBody({ traceId, rating, reason = null, note = '' }) {
  const id = typeof traceId === 'string' ? traceId.trim() : ''
  if (!id || (rating !== 'up' && rating !== 'down')) return null
  const body = { trace_id: id, rating }
  if (rating === 'down') {
    if (reason && CONCIERGE_FEEDBACK_REASONS.some((r) => r.id === reason)) body.reason = reason
    const text = String(note || '').trim().slice(0, CONCIERGE_FEEDBACK_NOTE_MAX)
    if (text) body.note = text
  }
  return body
}
