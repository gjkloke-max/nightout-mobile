import { supabase } from '../lib/supabase'
import { onReviewLiked } from './notificationHandlers'

async function notifyReviewAuthorOfLike({ reviewId, likerUserId }) {
  try {
    if (!supabase) return
    const { data: review } = await supabase
      .from('venue_review')
      .select('user_id')
      .eq('venue_review_id', reviewId)
      .maybeSingle()
    const authorId = review?.user_id
    if (!authorId || authorId === likerUserId) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', likerUserId)
      .maybeSingle()
    const actorName = profile ? [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim() : ''

    await onReviewLiked({
      recipientUserId: authorId,
      actorUserId: likerUserId,
      reviewId,
      actorName: actorName || undefined,
    })
  } catch (e) {
    console.error('notifyReviewAuthorOfLike', e)
  }
}

export async function likeReview(userId, reviewId) {
  if (!userId || !reviewId || !supabase) return { success: false, error: 'Invalid' }
  const { error } = await supabase.from('review_likes').insert({ user_id: userId, review_id: reviewId })
  if (error) return { success: false, error: error?.message }
  void notifyReviewAuthorOfLike({ reviewId, likerUserId: userId })
  return { success: true, error: undefined }
}

export async function unlikeReview(userId, reviewId) {
  if (!userId || !reviewId || !supabase) return { success: false, error: 'Invalid' }
  const { error } = await supabase
    .from('review_likes')
    .delete()
    .eq('user_id', userId)
    .eq('review_id', reviewId)
  return { success: !error, error: error?.message }
}
