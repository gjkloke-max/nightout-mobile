/**
 * Aggregation keys + copy for grouped social notifications.
 * Same key + recipient + time window → update one row instead of inserting.
 */

const DEFAULT_WINDOW_MS = 24 * 60 * 60 * 1000
const LIKE_WINDOW_MS = 2 * 60 * 60 * 1000

/**
 * @param {object} p
 * @param {string} p.type
 * @param {string|null} [p.entityType]
 * @param {string|null} [p.entityId]
 * @param {string|null} [p.actorUserId]
 * @returns {string|null}
 */
export function buildAggregationKey(p) {
  const { type, entityType, entityId, actorUserId } = p

  if (!type) return null

  const parts = [type]

  switch (type) {
    case 'post_commented':
    case 'post_liked':
      return null
    case 'comment_liked':
    case 'list_liked':
    case 'thread_replied':
    case 'comment_replied':
    case 'list_commented':
      if (entityType && entityId) {
        parts.push(entityType, entityId)
      } else {
        return null
      }
      break
    case 'user_followed_you':
      parts.push('global')
      break
    case 'following_user_created_list':
    case 'following_user_saved_place':
    case 'following_user_added_place_to_list':
      if (entityType && entityId) parts.push(entityType, entityId)
      else return null
      break
    case 'list_followed':
      if (entityId) parts.push('list', entityId)
      else return null
      break
    case 'follow_request_received':
    case 'follow_request_accepted':
    case 'follow_request_declined':
    case 'mentioned_in_comment':
    case 'mentioned_in_post':
    case 'list_collab_invited':
    case 'list_collab_accepted':
    case 'collaborative_list_updated':
      return null
    default:
      if (actorUserId && entityType && entityId) {
        return [type, actorUserId, entityType, entityId].join(':')
      }
      return null
  }

  return parts.join(':')
}

/**
 * @param {string} type
 * @returns {number}
 */
export function aggregationWindowMsForType(type) {
  if (
    type === 'comment_liked' ||
    type === 'post_liked' ||
    type === 'list_liked' ||
    type === 'list_commented' ||
    type === 'thread_replied' ||
    type === 'comment_replied'
  ) {
    return LIKE_WINDOW_MS
  }
  if (type === 'user_followed_you') return DEFAULT_WINDOW_MS
  return DEFAULT_WINDOW_MS
}

/**
 * Build human-readable body for aggregated rows.
 * @param {object} p
 * @param {string} p.type
 * @param {string[]} p.names — first names or display tokens
 * @param {number} p.totalActors
 * @param {string} [p.entityLabel] — e.g. "your comment"
 */
export function formatAggregatedBody(p) {
  const { type, names, totalActors, entityLabel = 'this' } = p
  const first = names[0] || 'Someone'
  const others = Math.max(0, totalActors - 1)

  const andOthers = others > 0 ? ` and ${others} other${others === 1 ? '' : 's'}` : ''

  switch (type) {
    case 'comment_liked':
    case 'post_liked':
    case 'list_liked':
      return others > 0
        ? `${first}${andOthers} liked ${entityLabel}.`
        : `${first} liked ${entityLabel}.`
    case 'user_followed_you':
      return totalActors > 1 ? `${first}${andOthers} followed you.` : `${first} started following you.`
    case 'list_commented':
    case 'post_commented':
      return others > 0
        ? `${first}${andOthers} commented on ${entityLabel}.`
        : `${first} commented on ${entityLabel}.`
    default:
      return `${first}${andOthers ? andOthers : ''} — ${type.replace(/_/g, ' ')}.`
  }
}
