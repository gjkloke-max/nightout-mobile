/**
 * Likes on review_comments rows (review_comment_likes).
 */

import { supabase } from '../lib/supabase'
import { onCommentLiked } from './notificationHandlers'

export async function enrichCommentsWithLikes(comments, viewerUserId) {
  if (!comments?.length || !supabase) return comments
  const ids = comments.map((c) => c.id).filter(Boolean)
  if (!ids.length) return comments

  const { data: rows } = await supabase
    .from('review_comment_likes')
    .select('comment_id, user_id')
    .in('comment_id', ids)

  const countBy = {}
  const likedByViewer = new Set()
  for (const r of rows || []) {
    countBy[r.comment_id] = (countBy[r.comment_id] || 0) + 1
    if (viewerUserId && r.user_id === viewerUserId) likedByViewer.add(r.comment_id)
  }

  return comments.map((c) => ({
    ...c,
    likeCount: countBy[c.id] ?? 0,
    likedByViewer: likedByViewer.has(c.id),
  }))
}

async function notifyCommentAuthorOfLike({ commentId, actorUserId, reviewId }) {
  try {
    const { data: row } = await supabase
      .from('review_comments')
      .select('user_id')
      .eq('id', commentId)
      .maybeSingle()
    const authorId = row?.user_id
    if (!authorId || authorId === actorUserId) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', actorUserId)
      .maybeSingle()
    const actorName = profile ? [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim() : ''

    await onCommentLiked({
      recipientUserId: authorId,
      actorUserId,
      commentId: String(commentId),
      reviewId: String(reviewId),
      actorName: actorName || undefined,
    })
  } catch (e) {
    console.error('notifyCommentAuthorOfLike', e)
  }
}

export async function toggleCommentLike(userId, commentId, reviewId) {
  if (!userId || !commentId || !supabase) return { success: false, liked: false, error: 'Invalid' }

  const { data: existing } = await supabase
    .from('review_comment_likes')
    .select('comment_id')
    .eq('comment_id', commentId)
    .eq('user_id', userId)
    .maybeSingle()

  if (existing) {
    await supabase.from('review_comment_likes').delete().eq('comment_id', commentId).eq('user_id', userId)
    const { count } = await supabase
      .from('review_comment_likes')
      .select('*', { count: 'exact', head: true })
      .eq('comment_id', commentId)
    return { success: true, liked: false, likeCount: count ?? 0 }
  }

  const { error } = await supabase.from('review_comment_likes').insert({ comment_id: commentId, user_id: userId })
  if (error) return { success: false, liked: false, error: error.message }

  void notifyCommentAuthorOfLike({ commentId, actorUserId: userId, reviewId })

  const { count } = await supabase
    .from('review_comment_likes')
    .select('*', { count: 'exact', head: true })
    .eq('comment_id', commentId)
  return { success: true, liked: true, likeCount: count ?? 0 }
}
