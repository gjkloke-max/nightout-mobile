/**
 * Cross-platform notification destinations.
 * Web routes match NightOut App.jsx; mobile_link is JSON for Expo/React Native linking.
 */

/**
 * @param {object} input
 * @param {string} [input.type]
 * @param {string|null} [input.entityType]
 * @param {string|null} [input.entityId]
 * @param {string|null} [input.parentEntityType]
 * @param {string|null} [input.parentEntityId]
 * @param {Record<string, unknown>} [input.metadata]
 * @returns {{ logical: object, web_link: string, mobile_link: string, deep_link: string }}
 */
export function buildNotificationDestination(input) {
  const { type, entityType, entityId, parentEntityType, parentEntityId, metadata = {} } = input

  if (type === 'follow_request_received' && metadata.requester_user_id) {
    const web = `/profile/${metadata.requester_user_id}`
    const mobile = { route: 'FriendProfile', params: { userId: metadata.requester_user_id } }
    return {
      logical: { type, entityType, entityId, parentEntityType, parentEntityId },
      web_link: web,
      mobile_link: JSON.stringify(mobile),
      deep_link: web,
    }
  }

  const web = buildWebPath({ type, entityType, entityId, parentEntityType, parentEntityId, metadata })
  const mobile = buildMobileTarget({ type, entityType, entityId, parentEntityType, parentEntityId, metadata })

  return {
    logical: {
      type: type || null,
      entityType: entityType || null,
      entityId: entityId || null,
      parentEntityType: parentEntityType || null,
      parentEntityId: parentEntityId || null,
    },
    web_link: web,
    mobile_link: JSON.stringify(mobile),
    deep_link: web,
  }
}

/**
 * @param {object} p
 * @returns {MobileNavigationTarget}
 */
function buildMobileTarget(p) {
  const { type, entityType, entityId, parentEntityType, parentEntityId, metadata } = p

  if (type === 'follow_request_received' && metadata?.requester_user_id) {
    return { route: 'FriendProfile', params: { userId: metadata.requester_user_id } }
  }
  if (entityType === 'follow_request' && entityId) {
    return { route: 'FriendRequests', params: {} }
  }

  switch (entityType) {
    case 'profile':
      return { route: 'FriendProfile', params: { userId: entityId } }
    case 'venue': {
      const vid = entityId || metadata?.venue_id
      return { route: 'Venues', params: { venueId: vid } }
    }
    case 'venue_review':
    case 'social_post':
      return {
        route: 'SocialReviewDetail',
        params: { reviewId: entityId, commentId: parentEntityId || metadata?.comment_id },
      }
    case 'review_comment':
      return {
        route: 'SocialReviewDetail',
        params: {
          reviewId: parentEntityId || metadata?.review_id,
          commentId: entityId,
        },
      }
    case 'venue_list':
      return {
        route: 'ListDetail',
        params: { listId: entityId, commentId: metadata?.comment_id },
      }
    case 'list_comment':
      return {
        route: 'ListDetail',
        params: {
          listId: parentEntityId || metadata?.list_id,
          commentId: entityId,
        },
      }
    case 'post':
      return { route: 'SocialReviewDetail', params: { reviewId: entityId, commentId: metadata?.comment_id } }
    default:
      if (metadata?.target_user_id) {
        return { route: 'FriendProfile', params: { userId: metadata.target_user_id } }
      }
      if (metadata?.requester_user_id) {
        return { route: 'FriendProfile', params: { userId: metadata.requester_user_id } }
      }
      return { route: 'Social', params: {} }
  }
}

function buildWebPath(p) {
  const { type, entityType, entityId, parentEntityType, parentEntityId, metadata } = p
  const q = (base, params) => {
    const u = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => {
      if (v != null && v !== '') u.set(k, String(v))
    })
    const s = u.toString()
    return s ? `${base}?${s}` : base
  }

  switch (entityType) {
    case 'profile':
      return `/profile/${entityId}`
    case 'follow_request':
      return '/dashboard/friend-requests'
    case 'venue':
      return q('/venues', { venue: entityId })
    case 'venue_review':
    case 'social_post':
      return parentEntityId || metadata?.comment_id
        ? q(`/social/review/${entityId}`, { commentId: parentEntityId || metadata?.comment_id })
        : `/social/review/${entityId}`
    case 'review_comment':
      return q(`/social/review/${parentEntityId || metadata?.review_id}`, { commentId: entityId })
    case 'venue_list':
      return metadata?.comment_id
        ? q(`/lists/${entityId}`, { commentId: metadata.comment_id })
        : `/lists/${entityId}`
    case 'list_comment':
      return q(`/lists/${parentEntityId || metadata?.list_id}`, { commentId: entityId })
    case 'post':
      return metadata?.comment_id
        ? q(`/social/review/${entityId}`, { commentId: metadata.comment_id })
        : `/social/review/${entityId}`
    default:
      if (metadata?.target_user_id) return `/profile/${metadata.target_user_id}`
      if (metadata?.requester_user_id) return `/profile/${metadata.requester_user_id}`
      return '/social'
  }
}
