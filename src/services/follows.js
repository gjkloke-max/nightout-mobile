import { supabase } from '../lib/supabase'

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
  return { success: true }
}
