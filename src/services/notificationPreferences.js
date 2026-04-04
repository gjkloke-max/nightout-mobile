/**
 * Notification preferences (categories) — stored in notification_preferences.settings JSONB.
 */

export const DEFAULT_NOTIFICATION_PREFERENCES = {
  follows: { in_app_enabled: true, mobile_push_enabled: true, web_push_enabled: true },
  follow_requests: { in_app_enabled: true, mobile_push_enabled: true, web_push_enabled: true },
  replies: { in_app_enabled: true, mobile_push_enabled: true, web_push_enabled: true },
  mentions: { in_app_enabled: true, mobile_push_enabled: true, web_push_enabled: true },
  likes: { in_app_enabled: true, mobile_push_enabled: true, web_push_enabled: true },
  lists: { in_app_enabled: true, mobile_push_enabled: true, web_push_enabled: true },
  collaboration: { in_app_enabled: true, mobile_push_enabled: true, web_push_enabled: true },
  social_activity: { in_app_enabled: true, mobile_push_enabled: true, web_push_enabled: true },
}

const CATEGORIES = /** @type {const} */ ([
  'follows',
  'follow_requests',
  'replies',
  'mentions',
  'likes',
  'lists',
  'collaboration',
  'social_activity',
])

/**
 * @param {string} type
 * @returns {keyof typeof DEFAULT_NOTIFICATION_PREFERENCES}
 */
export function mapNotificationTypeToCategory(type) {
  switch (type) {
    case 'user_followed_you':
    case 'following_user_created_list':
    case 'following_user_saved_place':
    case 'following_user_added_place_to_list':
      return 'follows'
    case 'follow_request_received':
    case 'follow_request_accepted':
    case 'follow_request_declined':
      return 'follow_requests'
    case 'comment_replied':
    case 'thread_replied':
    case 'list_commented':
      return 'replies'
    case 'mentioned_in_comment':
    case 'mentioned_in_post':
      return 'mentions'
    case 'comment_liked':
    case 'post_liked':
    case 'list_liked':
      return 'likes'
    case 'list_followed':
      return 'lists'
    case 'list_collab_invited':
    case 'list_collab_accepted':
    case 'collaborative_list_updated':
      return 'collaboration'
    case 'post_commented':
      return 'social_activity'
    default:
      return 'social_activity'
  }
}

/**
 * @param {Record<string, unknown> | null | undefined} raw
 */
export function mergeNotificationSettings(raw) {
  const out = JSON.parse(JSON.stringify(DEFAULT_NOTIFICATION_PREFERENCES))
  if (!raw || typeof raw !== 'object') return out
  for (const cat of CATEGORIES) {
    const patch = raw[cat]
    if (patch && typeof patch === 'object') {
      out[cat] = { ...out[cat], ...patch }
    }
  }
  return out
}

export function isChannelEnabledForType(type, settings, channel) {
  const cat = mapNotificationTypeToCategory(type)
  const row = settings[cat]
  if (!row) return true
  if (channel === 'in_app') return row.in_app_enabled !== false
  if (channel === 'mobile_push') return row.mobile_push_enabled !== false
  if (channel === 'web_push') return row.web_push_enabled !== false
  return true
}
