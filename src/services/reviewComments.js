import { supabase } from '../lib/supabase'
import { onReviewCommented } from './notificationHandlers'

async function notifyReviewAuthorOfComment({ commentId, reviewId, actorUserId }) {
  try {
    const { data: review } = await supabase
      .from('venue_review')
      .select('user_id')
      .eq('venue_review_id', reviewId)
      .maybeSingle()
    const authorId = review?.user_id
    if (!authorId || authorId === actorUserId) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', actorUserId)
      .maybeSingle()
    const actorName = profile ? [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim() : ''

    await onReviewCommented({
      recipientUserId: authorId,
      actorUserId,
      reviewId,
      commentId,
      actorName: actorName || undefined,
    })
  } catch (e) {
    console.error('notifyReviewAuthorOfComment', e)
  }
}

export async function addComment(userId, reviewId, commentText) {
  if (!userId || !reviewId || !(commentText || '').trim() || !supabase) return { success: false, error: 'Invalid', data: null }
  const { data, error } = await supabase
    .from('review_comments')
    .insert({ review_id: reviewId, user_id: userId, comment_text: (commentText || '').trim() })
    .select('id, review_id, user_id, comment_text, created_at')
    .single()
  if (error) return { success: false, error: error?.message, data: null }

  void notifyReviewAuthorOfComment({ commentId: data.id, reviewId, actorUserId: userId })

  return { success: true, error: undefined, data }
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
