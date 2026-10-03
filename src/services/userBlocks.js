/**
 * Blocking, required by App Store Guideline 1.2 for an app carrying user-generated content.
 *
 * The real enforcement is in the database — RLS on dm_messages/dm_conversations and the
 * users_are_blocked SQL function (migrations/dm_blocking.sql in the web repo). A blocked person
 * holds their own Supabase token and can call the API directly, so anything enforced only here
 * would be advisory. What this module does is let the UI stop showing content and offer the
 * action; if it ever disagrees with the database, the database wins.
 *
 * Blocks are bidirectional. One row records who pressed the button, but neither party sees the
 * other afterwards, so every read here matches both columns.
 */
import { supabase } from '../lib/supabase'

/**
 * Everyone the viewer cannot see, in either direction.
 *
 * Cached for the session because the social feed, comments, search and notifications each need it
 * and the set changes only when someone presses block. Any mutation below clears it.
 * @type {Set<string>|null}
 */
let cachedBlockedIds = null

export function invalidateBlockedIdsCache() {
  cachedBlockedIds = null
}

/**
 * @param {string} userId viewer
 * @returns {Promise<Set<string>>} user ids to hide, both directions
 */
export async function getBlockedUserIds(userId) {
  if (!userId) return new Set()
  if (cachedBlockedIds) return cachedBlockedIds
  const { data, error } = await supabase
    .from('user_block')
    .select('blocker_user_id, blocked_user_id')
    .or(`blocker_user_id.eq.${userId},blocked_user_id.eq.${userId}`)
  if (error) {
    // Failing open would show content the viewer has blocked, so fail closed-ish: return an empty
    // set but do not cache it, so the next call retries rather than hiding the block all session.
    console.warn('[userBlocks] load', error)
    return new Set()
  }
  const ids = new Set()
  for (const row of data || []) {
    const other = row.blocker_user_id === userId ? row.blocked_user_id : row.blocker_user_id
    if (other) ids.add(other)
  }
  cachedBlockedIds = ids
  return ids
}

/**
 * Filter a list of rows down to those whose author is visible to the viewer.
 * @param {Array<object>} rows
 * @param {(row: object) => string|null|undefined} getUserId
 * @param {Set<string>} blockedIds
 */
export function withoutBlocked(rows, getUserId, blockedIds) {
  if (!blockedIds?.size) return rows || []
  return (rows || []).filter((r) => {
    const id = getUserId(r)
    return !id || !blockedIds.has(id)
  })
}

/**
 * @param {string} blockedUserId
 * @returns {Promise<{ error: { message: string }|null }>}
 */
export async function blockUser(blockedUserId) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: { message: 'You are signed out.' } }
  if (!blockedUserId || blockedUserId === user.id) {
    return { error: { message: 'You cannot block yourself.' } }
  }
  const { error } = await supabase
    .from('user_block')
    .insert({ blocker_user_id: user.id, blocked_user_id: blockedUserId })
  // Already blocked is the outcome the caller wanted, not a failure to report.
  if (error && error.code !== '23505') {
    console.warn('[userBlocks] block', error)
    return { error: { message: 'Could not block this person. Please try again.' } }
  }
  invalidateBlockedIdsCache()
  return { error: null }
}

/**
 * @param {string} blockedUserId
 */
export async function unblockUser(blockedUserId) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: { message: 'You are signed out.' } }
  // Only the row this viewer created — unblocking must not clear a block placed against them.
  const { error } = await supabase
    .from('user_block')
    .delete()
    .eq('blocker_user_id', user.id)
    .eq('blocked_user_id', blockedUserId)
  if (error) {
    console.warn('[userBlocks] unblock', error)
    return { error: { message: 'Could not unblock this person. Please try again.' } }
  }
  invalidateBlockedIdsCache()
  return { error: null }
}

/**
 * Whether the viewer blocked them, them the viewer, or neither.
 *
 * `canUnblock` separates the two cases the UI must not conflate: you can undo your own block, but
 * you are never told that someone blocked you, and you certainly cannot lift it.
 * @param {string} otherUserId
 */
export async function getBlockState(otherUserId) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !otherUserId) return { blocked: false, canUnblock: false }
  const { data, error } = await supabase
    .from('user_block')
    .select('blocker_user_id, blocked_user_id')
    .or(
      `and(blocker_user_id.eq.${user.id},blocked_user_id.eq.${otherUserId}),` +
        `and(blocker_user_id.eq.${otherUserId},blocked_user_id.eq.${user.id})`,
    )
  if (error) {
    console.warn('[userBlocks] state', error)
    return { blocked: false, canUnblock: false }
  }
  const rows = data || []
  if (!rows.length) return { blocked: false, canUnblock: false }
  return {
    blocked: true,
    canUnblock: rows.some((r) => r.blocker_user_id === user.id),
  }
}
