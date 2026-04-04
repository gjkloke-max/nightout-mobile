/**
 * Follow graph: follow/unfollow, follow requests for private accounts
 * (aligned with NightOut web `follows.js` + notification wiring.)
 */

import { supabase } from '../lib/supabase'
import {
  onFollowCreated,
  onFollowRequestAccepted,
  onFollowRequestCreated,
  onFollowRequestDeclined,
} from './notificationHandlers'

export async function getTargetIsPrivate(targetUserId) {
  if (!targetUserId || !supabase) return false
  const { data } = await supabase.from('profiles').select('is_private').eq('id', targetUserId).maybeSingle()
  return !!data?.is_private
}

export async function getFollowStatus(requesterId, targetId) {
  if (!requesterId || !targetId || requesterId === targetId || !supabase) return 'none'
  const [followData, requestData] = await Promise.all([
    supabase.from('user_follows').select('follower_user_id').eq('follower_user_id', requesterId).eq('followed_user_id', targetId).maybeSingle(),
    supabase.from('follow_requests').select('id').eq('requester_user_id', requesterId).eq('target_user_id', targetId).eq('status', 'pending').maybeSingle(),
  ])
  if (followData.data) return 'following'
  if (requestData.data) return 'pending'
  return 'none'
}

/** Batch get follow status for multiple targets. Returns Map<targetId, 'following'|'pending'|'none'> */
export async function getFollowStatusBatch(requesterId, targetIds) {
  if (!requesterId || !targetIds?.length || !supabase) return new Map()
  const ids = [...new Set(targetIds)].filter(Boolean)
  const [followData, requestData] = await Promise.all([
    supabase.from('user_follows').select('followed_user_id').eq('follower_user_id', requesterId).in('followed_user_id', ids),
    supabase.from('follow_requests').select('target_user_id').eq('requester_user_id', requesterId).eq('status', 'pending').in('target_user_id', ids),
  ])
  const followingIds = new Set((followData.data || []).map((r) => r.followed_user_id))
  const pendingIds = new Set((requestData.data || []).map((r) => r.target_user_id))
  const map = new Map()
  ids.forEach((id) => {
    if (followingIds.has(id)) map.set(id, 'following')
    else if (pendingIds.has(id)) map.set(id, 'pending')
    else map.set(id, 'none')
  })
  return map
}

export async function followOrRequest(requesterId, targetId) {
  if (!requesterId || !targetId || requesterId === targetId || !supabase) return { success: false, error: 'Invalid', status: null }
  const isPrivate = await getTargetIsPrivate(targetId)
  if (isPrivate) {
    return requestFollow(requesterId, targetId)
  }
  const { error } = await supabase
    .from('user_follows')
    .insert({ follower_user_id: requesterId, followed_user_id: targetId })
  if (error) return { success: false, error: error?.message, status: null }
  const { data: followerProfile } = await supabase.from('profiles').select('first_name, last_name').eq('id', requesterId).maybeSingle()
  const displayName = [followerProfile?.first_name, followerProfile?.last_name].filter(Boolean).join(' ').trim() || undefined
  await onFollowCreated({ followerId: requesterId, followedId: targetId, actorDisplayName: displayName })
  return { success: true, error: undefined, status: 'following' }
}

export async function requestFollow(requesterId, targetId) {
  if (!requesterId || !targetId || requesterId === targetId || !supabase) return { success: false, error: 'Invalid', status: null }
  const { data: existing } = await supabase
    .from('follow_requests')
    .select('id, status')
    .eq('requester_user_id', requesterId)
    .eq('target_user_id', targetId)
    .maybeSingle()
  if (existing?.status === 'pending') {
    return { success: true, status: 'pending' }
  }
  if (existing && existing.status !== 'pending') {
    const { error: delErr } = await supabase.from('follow_requests').delete().eq('id', existing.id)
    if (delErr) return { success: false, error: delErr.message, status: null }
  }
  const { data: req, error } = await supabase
    .from('follow_requests')
    .insert({ requester_user_id: requesterId, target_user_id: targetId, status: 'pending' })
    .select('id')
    .single()
  if (error) return { success: false, error: error.message, status: null }
  const { data: requesterProfile } = await supabase.from('profiles').select('first_name, last_name, avatar_url').eq('id', requesterId).single()
  const displayName = [requesterProfile?.first_name, requesterProfile?.last_name].filter(Boolean).join(' ') || 'A user'
  await onFollowRequestCreated({
    targetUserId: targetId,
    requesterId,
    requestId: String(req.id),
    requesterName: displayName,
    requesterAvatarUrl: requesterProfile?.avatar_url || null,
  })
  return { success: true, status: 'pending' }
}

export async function acceptFollowRequest(targetUserId, requesterUserId) {
  if (!targetUserId || !requesterUserId || !supabase) return { success: false }
  const { data: req } = await supabase
    .from('follow_requests')
    .select('id')
    .eq('requester_user_id', requesterUserId)
    .eq('target_user_id', targetUserId)
    .eq('status', 'pending')
    .maybeSingle()
  if (!req) return { success: false }
  await supabase.from('follow_requests').update({ status: 'accepted' }).eq('id', req.id)
  await supabase.from('user_follows').insert({ follower_user_id: requesterUserId, followed_user_id: targetUserId })
  const { data: targetProfile } = await supabase.from('profiles').select('first_name, last_name, avatar_url').eq('id', targetUserId).single()
  const displayName = [targetProfile?.first_name, targetProfile?.last_name].filter(Boolean).join(' ') || 'They'
  await onFollowRequestAccepted({
    requesterUserId,
    targetUserId,
    targetName: displayName,
    targetAvatarUrl: targetProfile?.avatar_url || null,
  })
  return { success: true }
}

export async function denyFollowRequest(targetUserId, requesterUserId) {
  if (!targetUserId || !requesterUserId || !supabase) return { success: false }
  const { data: req } = await supabase
    .from('follow_requests')
    .select('id')
    .eq('requester_user_id', requesterUserId)
    .eq('target_user_id', targetUserId)
    .eq('status', 'pending')
    .maybeSingle()
  if (!req) return { success: false }
  await supabase.from('follow_requests').update({ status: 'denied' }).eq('id', req.id)
  const { data: targetProfile } = await supabase.from('profiles').select('first_name, last_name, avatar_url').eq('id', targetUserId).single()
  const displayName = [targetProfile?.first_name, targetProfile?.last_name].filter(Boolean).join(' ') || 'They'
  await onFollowRequestDeclined({
    requesterUserId,
    targetUserId,
    targetName: displayName,
    targetAvatarUrl: targetProfile?.avatar_url || null,
  })
  return { success: true }
}

export async function cancelFollowRequest(requesterId, targetId) {
  if (!requesterId || !targetId || !supabase) return { success: false }
  const { error } = await supabase
    .from('follow_requests')
    .delete()
    .eq('requester_user_id', requesterId)
    .eq('target_user_id', targetId)
    .eq('status', 'pending')
  return { success: !error }
}

export async function followUser(followerId, followedId) {
  return followOrRequest(followerId, followedId)
}

export async function unfollowUser(followerId, followedId) {
  if (!followerId || !followedId || !supabase) return { success: false, error: 'Invalid unfollow' }
  const { error } = await supabase
    .from('user_follows')
    .delete()
    .eq('follower_user_id', followerId)
    .eq('followed_user_id', followedId)
  return { success: !error, error: error?.message }
}

export async function isFollowing(followerId, followedId) {
  if (!followerId || !followedId || !supabase) return false
  const { data } = await supabase
    .from('user_follows')
    .select('follower_user_id')
    .eq('follower_user_id', followerId)
    .eq('followed_user_id', followedId)
    .maybeSingle()
  return !!data
}

export async function getFollowCounts(userId) {
  if (!userId || !supabase) return { followers: 0, following: 0 }
  const [followersRes, followingRes] = await Promise.all([
    supabase.from('user_follows').select('follower_user_id', { count: 'exact', head: true }).eq('followed_user_id', userId),
    supabase.from('user_follows').select('followed_user_id', { count: 'exact', head: true }).eq('follower_user_id', userId),
  ])
  return {
    followers: followersRes.count ?? 0,
    following: followingRes.count ?? 0,
  }
}

export async function getFollowers(userId, limit = 50) {
  if (!userId || !supabase) return []
  const { data } = await supabase
    .from('user_follows')
    .select('follower_user_id')
    .eq('followed_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (!data?.length) return []
  const ids = data.map((r) => r.follower_user_id)
  const { data: profiles } = await supabase.from('profiles').select('id, first_name, last_name, avatar_url').in('id', ids)
  const byId = Object.fromEntries((profiles || []).map((p) => [p.id, p]))
  return ids.map((id) => ({ userId: id, profile: byId[id] || null }))
}

export async function canViewPrivateProfile(targetUserId, viewerUserId) {
  if (!targetUserId || !viewerUserId || !supabase) return false
  if (targetUserId === viewerUserId) return true
  const { data: profile } = await supabase.from('profiles').select('is_private').eq('id', targetUserId).single()
  if (!profile?.is_private) return true
  const { data } = await supabase
    .from('user_follows')
    .select('follower_user_id')
    .eq('follower_user_id', viewerUserId)
    .eq('followed_user_id', targetUserId)
    .maybeSingle()
  return !!data
}

export async function getFollowing(userId, limit = 50) {
  if (!userId || !supabase) return []
  const { data } = await supabase
    .from('user_follows')
    .select('followed_user_id')
    .eq('follower_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (!data?.length) return []
  const ids = data.map((r) => r.followed_user_id)
  const { data: profiles } = await supabase.from('profiles').select('id, first_name, last_name, avatar_url').in('id', ids)
  const byId = Object.fromEntries((profiles || []).map((p) => [p.id, p]))
  return ids.map((id) => ({ userId: id, profile: byId[id] || null }))
}
