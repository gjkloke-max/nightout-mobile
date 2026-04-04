/**
 * Unified notifications service (web + mobile + push-ready payloads).
 * DB shape: migrations/social_notifications_system.sql
 */

import { supabase } from '../lib/supabase'
import { buildNotificationDestination } from './notificationNavigation'
import {
  buildAggregationKey,
  aggregationWindowMsForType,
  formatAggregatedBody,
} from './notificationAggregation'
import {
  mergeNotificationSettings,
  isChannelEnabledForType,
  mapNotificationTypeToCategory,
} from './notificationPreferences'

const LEGACY_TYPE_MAP = {
  follow_request: 'follow_request_received',
  follow_accepted: 'follow_request_accepted',
  follow_denied: 'follow_request_declined',
}

/**
 * @typedef {import('../types/notifications').NotificationPayload} NotificationPayload
 */

/**
 * @param {unknown} v
 * @returns {v is NotificationPayload}
 */
function isPayloadShape(v) {
  return (
    typeof v === 'object' &&
    v !== null &&
    'recipientUserId' in v &&
    typeof /** @type {{ recipientUserId: unknown }} */ (v).recipientUserId === 'string'
  )
}

/**
 * Create a notification row. Supports legacy (recipientId, type, metadata) or full payload object.
 * @param {string|NotificationPayload} recipientOrPayload
 * @param {string} [type]
 * @param {Record<string, unknown>} [metadata]
 */
export async function createNotification(recipientOrPayload, type, metadata) {
  if (isPayloadShape(recipientOrPayload)) {
    return createOrAggregateNotification(recipientOrPayload)
  }
  const meta = metadata || {}
  const normalizedType = LEGACY_TYPE_MAP[type] || type
  return createOrAggregateNotification({
    recipientUserId: /** @type {string} */ (recipientOrPayload),
    type: normalizedType,
    metadata: meta,
    actorUserId: meta.requester_user_id || meta.target_user_id || null,
  })
}

/**
 * @param {NotificationPayload} payload
 */
export async function createOrAggregateNotification(payload) {
  const normalized = normalizePayload(payload)
  if (!normalized.recipientUserId || !normalized.type) {
    return { success: false, error: 'Invalid notification payload' }
  }

  if (normalized.skipIfSelf && normalized.actorUserId && normalized.actorUserId === normalized.recipientUserId) {
    return { success: true, skipped: true }
  }

  const prefs = await fetchPreferences(normalized.recipientUserId)
  if (!isChannelEnabledForType(normalized.type, prefs, 'in_app')) {
    return { success: true, skipped: true, reason: 'in_app_disabled' }
  }

  const useAgg =
    normalized.aggregationKey ||
    buildAggregationKey({
      type: normalized.type,
      entityType: normalized.entityType,
      entityId: normalized.entityId,
      actorUserId: normalized.actorUserId,
    })

  const windowMs = normalized.aggregationWindowMs ?? aggregationWindowMsForType(normalized.type)
  const aggKey = normalized.aggregationKey ?? useAgg

  if (aggKey && windowMs > 0) {
    const aggResult = await tryAggregateIntoExisting(normalized, aggKey, windowMs)
    if (aggResult?.aggregated) return aggResult
  }

  return insertNotificationRow(normalized, aggKey)
}

/**
 * @param {NotificationPayload} p
 */
function normalizePayload(p) {
  const type = LEGACY_TYPE_MAP[p.type] || p.type
  const links =
    p.webLink && p.mobileLink
      ? { web_link: p.webLink, mobile_link: p.mobileLink, deep_link: p.deepLink || p.webLink }
      : buildNotificationDestination({
          type,
          entityType: p.entityType,
          entityId: p.entityId,
          parentEntityType: p.parentEntityType,
          parentEntityId: p.parentEntityId,
          metadata: p.metadata || {},
        })

  return {
    recipientUserId: p.recipientUserId,
    type,
    actorUserId: p.actorUserId ?? p.metadata?.requester_user_id ?? p.metadata?.target_user_id ?? null,
    entityType: p.entityType ?? null,
    entityId: p.entityId ?? null,
    parentEntityType: p.parentEntityType ?? null,
    parentEntityId: p.parentEntityId ?? null,
    title: p.title ?? null,
    body: p.body ?? null,
    imageUrl: p.imageUrl ?? null,
    iconType: p.iconType ?? null,
    actionType: p.actionType ?? null,
    deepLink: p.deepLink ?? links.deep_link,
    webLink: p.webLink ?? links.web_link,
    mobileLink: p.mobileLink ?? links.mobile_link,
    metadata: p.metadata && typeof p.metadata === 'object' ? { ...p.metadata } : {},
    aggregationKey: p.aggregationKey ?? null,
    aggregationWindowMs: p.aggregationWindowMs,
    skipIfSelf: p.skipIfSelf !== false,
  }
}

async function fetchPreferences(userId) {
  const { data } = await supabase.from('notification_preferences').select('settings').eq('user_id', userId).maybeSingle()
  return mergeNotificationSettings(data?.settings)
}

/**
 * @param {ReturnType<typeof normalizePayload>} n
 * @param {string} aggKey
 * @param {number} windowMs
 */
async function tryAggregateIntoExisting(n, aggKey, windowMs) {
  const since = new Date(Date.now() - windowMs).toISOString()
  const { data: existing } = await supabase
    .from('notifications')
    .select('id, metadata, actor_user_id, created_at')
    .eq('recipient_user_id', n.recipientUserId)
    .eq('aggregation_key', aggKey)
    .gte('created_at', since)
    .eq('is_hidden', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!existing) return null

  const meta = mergeActorPreview(existing.metadata || {}, n)
  const names = meta.actor_preview_names || []
  const total = Math.max(meta.actor_count || 0, names.length, 1)
  const entityLabel = meta.entity_label || 'this'

  const body = formatAggregatedBody({
    type: n.type,
    names,
    totalActors: total,
    entityLabel,
  })

  const { error } = await supabase
    .from('notifications')
    .update({
      body,
      metadata: meta,
      actor_user_id: n.actorUserId || existing.actor_user_id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', existing.id)

  if (error) {
    console.warn('[notifications] aggregate update failed (will insert new row if needed):', error.message)
    return null
  }
  await maybeEnqueueDelivery(existing.id, n, 'in_app')
  return { success: true, id: existing.id, aggregated: true }
}

/**
 * @param {Record<string, unknown>} existingMeta
 * @param {ReturnType<typeof normalizePayload>} n
 */
function mergeActorPreview(existingMeta, n) {
  const meta = { ...existingMeta }
  const id = n.actorUserId
  const name =
    meta.actor_single_name ||
    (n.metadata?.requester_name) ||
    (n.metadata?.actor_display_name) ||
    'Someone'

  const ids = new Set(/** @type {string[]} */ (meta.actor_preview_ids || []).filter(Boolean))
  if (id) {
    if (ids.has(id)) {
      return meta
    }
    ids.add(id)
  }

  const names = [...(meta.actor_preview_names || [])]
  if (name && !names.includes(name)) names.unshift(name)

  meta.actor_preview_ids = [...ids]
  meta.actor_preview_names = names.slice(0, 5)
  meta.actor_count = ids.size || names.length
  if (n.metadata?.entity_label) meta.entity_label = n.metadata.entity_label
  return meta
}

/**
 * @param {ReturnType<typeof normalizePayload>} n
 * @param {string|null} aggKey
 */
/** @param {{ code?: string, message?: string } | null | undefined} e */
function isInsertRpcMissing(e) {
  if (!e) return false
  const msg = e.message || ''
  return (
    e.code === 'PGRST202' ||
    e.code === '42883' ||
    msg.includes('Could not find the function') ||
    msg.includes('does not exist')
  )
}

async function insertNotificationRow(n, aggKey) {
  const row = {
    recipient_user_id: n.recipientUserId,
    actor_user_id: n.actorUserId,
    type: n.type,
    entity_type: n.entityType,
    entity_id: n.entityId,
    parent_entity_type: n.parentEntityType,
    parent_entity_id: n.parentEntityId,
    title: n.title,
    body: n.body || defaultBodyForType(n),
    image_url: n.imageUrl,
    icon_type: n.iconType,
    action_type: n.actionType,
    deep_link: n.deepLink,
    web_link: n.webLink,
    mobile_link: n.mobileLink,
    aggregation_key: aggKey,
    metadata: buildInitialMetadata(n),
  }

  const { data: rpcId, error: rpcErr } = await supabase.rpc('insert_notification_for_actor', {
    p_row: row,
  })
  if (!rpcErr && rpcId != null) {
    const id = typeof rpcId === 'bigint' ? Number(rpcId) : rpcId
    await maybeEnqueueDelivery(id, n, 'in_app')
    await maybeEnqueuePush(id, n)
    return { success: true, id }
  }

  if (rpcErr && !isInsertRpcMissing(rpcErr)) {
    console.error('[notifications] insert_notification_for_actor failed', {
      type: n.type,
      message: rpcErr.message,
      code: rpcErr.code,
    })
    return { success: false, error: rpcErr.message }
  }

  const { data, error } = await supabase.from('notifications').insert(row).select('id').single()
  if (error) {
    console.error('[notifications] insert failed', { type: n.type, message: error.message, code: error.code })
    return { success: false, error: error.message }
  }

  await maybeEnqueueDelivery(data.id, n, 'in_app')
  await maybeEnqueuePush(data.id, n)
  return { success: true, id: data.id }
}

/**
 * @param {ReturnType<typeof normalizePayload>} n
 */
function buildInitialMetadata(n) {
  const meta = { ...n.metadata }
  if (n.actorUserId) {
    meta.actor_preview_ids = [n.actorUserId]
    const nm = meta.requester_name || meta.actor_display_name || meta.target_name
    if (nm) meta.actor_preview_names = [nm]
    meta.actor_count = 1
  }
  return meta
}

/**
 * @param {ReturnType<typeof normalizePayload>} n
 */
function defaultBodyForType(n) {
  const actor = n.metadata?.requester_name || n.metadata?.actor_display_name || n.metadata?.target_name
  const a = actor ? `${actor} ` : ''
  switch (n.type) {
    case 'follow_request_received':
      return `${a}sent you a follow request`.trim()
    case 'follow_request_accepted':
      return `${a}accepted your follow request`.trim()
    case 'follow_request_declined':
      return `${a}declined your follow request`.trim()
    case 'user_followed_you':
      return `${a}started following you`.trim()
    default:
      return n.type.replace(/_/g, ' ')
  }
}

/**
 * Push-ready: extend with worker later (service role inserts into notification_deliveries).
 * @param {number} notificationId
 * @param {ReturnType<typeof normalizePayload>} n
 */
async function maybeEnqueuePush(notificationId, n) {
  const prefs = await fetchPreferences(n.recipientUserId)
  const channels = []
  if (isChannelEnabledForType(n.type, prefs, 'mobile_push')) channels.push('mobile_push')
  if (isChannelEnabledForType(n.type, prefs, 'web_push')) channels.push('web_push')
  await maybeEnqueueDelivery(notificationId, n, channels)
}

/**
 * @param {number} notificationId
 * @param {ReturnType<typeof normalizePayload>} n
 * @param {string|string[]} channel
 */
async function maybeEnqueueDelivery(notificationId, n, channel) {
  const payload = buildPushPayload(notificationId, n)
  void payload
  void channel
  // Delivery worker (future): read notification_deliveries or queue
}

export function buildPushPayload(notificationId, n) {
  return {
    notificationId,
    recipientUserId: n.recipientUserId,
    type: n.type,
    title: n.title || 'NightOut',
    body: n.body || defaultBodyForType(n),
    webLink: n.webLink,
    mobileLink: n.mobileLink,
    category: mapNotificationTypeToCategory(n.type),
  }
}

export async function markAsRead(notificationId, userId) {
  if (!notificationId || !userId) return { success: false }
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('recipient_user_id', userId)
  return { success: !error, error: error?.message }
}

export async function markManyAsRead(notificationIds, userId) {
  if (!userId || !notificationIds?.length) return { success: false }
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_user_id', userId)
    .in('id', notificationIds)
  return { success: !error, error: error?.message }
}

export async function markAllAsRead(userId) {
  if (!userId) return { success: false }
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_user_id', userId)
    .is('read_at', null)
  return { success: !error, error: error?.message }
}

/**
 * Mark notifications as seen (e.g. feed opened). Uses SECURITY DEFINER RPC when available.
 * @param {string} userId
 * @param {number[]|null} [ids] — null = all unseen for user
 */
export async function markAsSeen(userId, ids = null) {
  if (!userId) return { success: false }
  const rpcParams =
    ids != null && Array.isArray(ids) && ids.length > 0 ? { p_ids: ids } : {}
  const { data, error } = await supabase.rpc('mark_notifications_seen', rpcParams)
  if (!error) return { success: true, count: data }
  const q = supabase.from('notifications').update({ seen_at: new Date().toISOString() }).eq('recipient_user_id', userId).is('seen_at', null)
  const { error: err2 } = ids?.length ? await q.in('id', ids) : await q
  return { success: !err2, error: err2?.message }
}

export async function hideNotification(notificationId, userId) {
  if (!notificationId || !userId) return { success: false }
  const { error } = await supabase
    .from('notifications')
    .update({ is_hidden: true })
    .eq('id', notificationId)
    .eq('recipient_user_id', userId)
  return { success: !error, error: error?.message }
}

/**
 * Hide notifications pointing at removed entities (or invalidate like rows).
 */
export async function deleteInvalidNotificationsForEntity(entityType, entityId, options = {}) {
  const { alsoParentEntityId, types } = options
  let q = supabase.from('notifications').update({ is_hidden: true }).eq('entity_type', entityType).eq('entity_id', String(entityId))
  if (types?.length) q = q.in('type', types)
  await q
  if (alsoParentEntityId != null) {
    await supabase
      .from('notifications')
      .update({ is_hidden: true })
      .eq('parent_entity_type', entityType)
      .eq('parent_entity_id', String(alsoParentEntityId))
  }
  return { success: true }
}

function decodeCursorPair(cursor) {
  if (!cursor) return { created_at: null, id: null }
  try {
    const dec =
      typeof globalThis.atob === 'function'
        ? globalThis.atob(cursor)
        : Buffer.from(cursor, 'base64').toString('utf8')
    const parsed = JSON.parse(dec)
    return { created_at: parsed.c, id: parsed.i }
  } catch {
    return { created_at: null, id: null }
  }
}

function encodeCursorPair(createdAt, id) {
  const raw = JSON.stringify({ c: createdAt, i: id })
  if (typeof globalThis.btoa === 'function') return globalThis.btoa(raw)
  return Buffer.from(raw, 'utf8').toString('base64')
}

/**
 * @param {string} userId
 * @param {{ cursor?: string|null, limit?: number, includeCounts?: boolean }} [opts]
 */
export async function getNotificationsForUser(userId, opts = {}) {
  if (!userId) {
    return { notifications: [], nextCursor: null, unreadCount: 0, unseenCount: 0 }
  }
  const includeCounts = opts.includeCounts !== false
  try {
    const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100)
    const decoded = decodeCursorPair(opts.cursor || '')
    const cursorCreated = decoded.created_at
    const cursorId = decoded.id

    const { data: rpcData, error: rpcError } = await supabase.rpc('get_notifications_feed', {
      p_limit: limit,
      p_cursor_created_at: cursorCreated,
      p_cursor_id: cursorId,
    })

    let rows = rpcError ? null : rpcData
    if (rpcError || !rows) {
      let q = supabase
        .from('notifications')
        .select('*')
        .eq('recipient_user_id', userId)
        .eq('is_hidden', false)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(limit)

      if (cursorCreated != null && cursorId != null) {
        q = q.or(`created_at.lt.${cursorCreated},and(created_at.eq.${cursorCreated},id.lt.${cursorId})`)
      }
      const { data: fallback } = await q
      rows = fallback || []
    }

    const list = rows || []
    const last = list[list.length - 1]
    const nextCursor =
      list.length >= limit && last ? encodeCursorPair(last.created_at, last.id) : null

    let unreadCount = 0
    let unseenCount = 0
    if (includeCounts) {
      const [ur, us] = await Promise.allSettled([getUnreadCount(userId), getUnseenCount(userId)])
      unreadCount = ur.status === 'fulfilled' ? ur.value : 0
      unseenCount = us.status === 'fulfilled' ? us.value : 0
    }

    return {
      notifications: list.map(mapRowForClient),
      nextCursor,
      unreadCount,
      unseenCount,
    }
  } catch (e) {
    console.error('getNotificationsForUser', e)
    return { notifications: [], nextCursor: null, unreadCount: 0, unseenCount: 0 }
  }
}

/** Back-compat list API */
export async function getNotifications(userId, limit = 50) {
  const { notifications } = await getNotificationsForUser(userId, { limit })
  return notifications
}

function mapRowForClient(row) {
  return {
    ...row,
    is_read: !!row.read_at,
    payload: row.metadata,
  }
}

export async function getUnreadCount(userId) {
  if (!userId) return 0
  const { count } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('recipient_user_id', userId)
    .is('read_at', null)
    .eq('is_hidden', false)
  return count ?? 0
}

/** Badge: notifications not yet viewed in feed (seen_at IS NULL). */
export async function getUnseenCount(userId) {
  if (!userId) return 0
  const { count } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('recipient_user_id', userId)
    .is('seen_at', null)
    .eq('is_hidden', false)
  return count ?? 0
}

export async function deleteNotification(notificationId, userId) {
  if (!notificationId || !userId) return { success: false }
  const { error } = await supabase.from('notifications').delete().eq('id', notificationId).eq('recipient_user_id', userId)
  return { success: !error, error: error?.message }
}

export async function getNotificationPreferences(userId) {
  if (!userId) return mergeNotificationSettings(null)
  const { data } = await supabase.from('notification_preferences').select('settings').eq('user_id', userId).maybeSingle()
  return mergeNotificationSettings(data?.settings)
}

export async function upsertNotificationPreferences(userId, settings) {
  if (!userId) return { success: false }
  const merged = mergeNotificationSettings(settings)
  const { error } = await supabase.from('notification_preferences').upsert(
    { user_id: userId, settings: merged, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' }
  )
  return { success: !error, error: error?.message }
}

export { buildNotificationDestination } from './notificationNavigation'
export { buildAggregationKey, formatAggregatedBody } from './notificationAggregation'
export {
  mergeNotificationSettings,
  mapNotificationTypeToCategory,
  DEFAULT_NOTIFICATION_PREFERENCES,
} from './notificationPreferences'
