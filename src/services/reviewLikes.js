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

export async function getLikedReviewIds(userId, reviewIds) {
  if (!userId || !reviewIds?.length || !supabase) return new Set()
  const { data } = await supabase
    .from('review_likes')
    .select('review_id')
    .eq('user_id', userId)
    .in('review_id', reviewIds)
  return new Set((data || []).map((r) => r.review_id))
}

export async function getLikeCountsByReviewIds(reviewIds) {
  const ids = [...new Set((reviewIds || []).filter(Boolean))]
  if (!ids.length || !supabase) return {}
  const { data, error } = await supabase.from('review_likes').select('review_id').in('review_id', ids)
  if (error) {
    console.error('getLikeCountsByReviewIds', error)
    return {}
  }
  const counts = {}
  for (const row of data || []) {
    const id = row.review_id
    counts[id] = (counts[id] || 0) + 1
  }
  return counts
}
