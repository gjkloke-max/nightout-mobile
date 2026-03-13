import { supabase } from '../lib/supabase'

export async function addComment(userId, reviewId, commentText) {
  if (!userId || !reviewId || !(commentText || '').trim() || !supabase) return { success: false, error: 'Invalid', data: null }
  const { data, error } = await supabase
    .from('review_comments')
    .insert({ review_id: reviewId, user_id: userId, comment_text: (commentText || '').trim() })
    .select('id, review_id, user_id, comment_text, created_at')
    .single()
  return { success: !error, error: error?.message, data }
}

export async function getCommentsWithProfiles(reviewId) {
  if (!reviewId || !supabase) return []
  const { data: comments } = await supabase
    .from('review_comments')
    .select('id, review_id, user_id, comment_text, created_at')
    .eq('review_id', reviewId)
    .order('created_at', { ascending: true })
  if (!comments?.length) return []
  const userIds = [...new Set(comments.map((c) => c.user_id))]
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, avatar_url')
    .in('id', userIds)
  const byId = Object.fromEntries((profiles || []).map((p) => [p.id, p]))
  return comments.map((c) => ({ ...c, profile: byId[c.user_id] || null }))
}
