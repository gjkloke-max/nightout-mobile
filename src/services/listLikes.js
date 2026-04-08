/**
 * Venue list likes (aligned with web listLikes.js)
 */

import { supabase } from '../lib/supabase'
import { onListLiked } from './notificationHandlers'

async function notifyListOwnerOfLike({ listId, likerUserId }) {
  try {
    if (!supabase) return
    const { data: row } = await supabase
      .from('venue_list')
      .select('user_id')
      .eq('list_id', listId)
      .maybeSingle()
    const ownerId = row?.user_id
    if (!ownerId || ownerId === likerUserId) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', likerUserId)
      .maybeSingle()
    const actorName = profile ? [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim() : ''

    await onListLiked({
      recipientUserId: ownerId,
      actorUserId: likerUserId,
      listId: String(listId),
      actorName: actorName || undefined,
    })
  } catch (e) {
    console.error('notifyListOwnerOfLike', e)
  }
}

export async function likeList(userId, listId) {
  if (!userId || listId == null || !supabase) return { success: false, error: 'Invalid' }
  const id = Number(listId)
  if (Number.isNaN(id)) return { success: false, error: 'Invalid list' }
  const { error } = await supabase.from('venue_list_likes').insert({ user_id: userId, list_id: id })
  if (error) return { success: false, error: error?.message }
  void notifyListOwnerOfLike({ listId: id, likerUserId: userId })
  return { success: true, error: undefined }
}

export async function unlikeList(userId, listId) {
  if (!userId || listId == null || !supabase) return { success: false, error: 'Invalid' }
  const id = Number(listId)
  if (Number.isNaN(id)) return { success: false, error: 'Invalid list' }
  const { error } = await supabase.from('venue_list_likes').delete().eq('user_id', userId).eq('list_id', id)
  return { success: !error, error: error?.message }
}

export async function toggleListLike(userId, listId, currentlyLiked) {
  if (currentlyLiked) return unlikeList(userId, listId)
  return likeList(userId, listId)
}

export async function getLikeCountsByListIds(listIds) {
  if (!supabase) return {}
  const ids = [...new Set((listIds || []).map((x) => Number(x)).filter((n) => !Number.isNaN(n)))]
  if (!ids.length) return {}
  const { data, error } = await supabase.from('venue_list_likes').select('list_id').in('list_id', ids)
  if (error) {
    console.error('getLikeCountsByListIds', error)
    return {}
  }
  const counts = {}
  for (const row of data || []) {
    const id = row.list_id
    counts[id] = (counts[id] || 0) + 1
  }
  return counts
}

export async function getLikedListIds(userId, listIds) {
  if (!userId || !listIds?.length || !supabase) return new Set()
  const ids = [...new Set((listIds || []).map((x) => Number(x)).filter((n) => !Number.isNaN(n)))]
  if (!ids.length) return new Set()
  const { data } = await supabase.from('venue_list_likes').select('list_id').eq('user_id', userId).in('list_id', ids)
  return new Set((data || []).map((r) => r.list_id))
}
