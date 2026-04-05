import { supabase } from '../lib/supabase'
import { onReviewCommented, onCommentReplyCreated, onCommentMentioned } from './notificationHandlers'
import { enrichCommentsWithLikes } from './commentLikes'

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

async function notifyParentOfReply({ parentCommentId, newCommentId, reviewId, actorUserId }) {
  try {
    const { data: parent } = await supabase
      .from('review_comments')
      .select('user_id')
      .eq('id', parentCommentId)
      .maybeSingle()
    const parentAuthor = parent?.user_id
    if (!parentAuthor || parentAuthor === actorUserId) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', actorUserId)
      .maybeSingle()
    const actorName = profile ? [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim() : ''

    await onCommentReplyCreated({
      recipientUserId: parentAuthor,
      actorUserId,
      commentId: String(newCommentId),
      reviewId: String(reviewId),
      actorName: actorName || undefined,
    })
  } catch (e) {
    console.error('notifyParentOfReply', e)
  }
}

async function notifyMentionedUsers({ mentionedUserIds, commentId, reviewId, actorUserId, excludeIds = new Set() }) {
  if (!mentionedUserIds?.length) return
  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name, last_name')
    .eq('id', actorUserId)
    .maybeSingle()
  const actorName = profile ? [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim() : ''

  for (const uid of new Set(mentionedUserIds)) {
    if (!uid || uid === actorUserId || excludeIds.has(uid)) continue
    try {
      await onCommentMentioned({
        recipientUserId: uid,
        actorUserId,
        commentId: String(commentId),
        reviewId: String(reviewId),
        actorName: actorName || undefined,
      })
    } catch (e) {
      console.error('notifyMentionedUsers', e)
    }
  }
}

export async function addComment(userId, reviewId, commentText, opts = {}) {
  if (!userId || !reviewId || !(commentText || '').trim() || !supabase) return { success: false, error: 'Invalid', data: null }
  const trimmed = (commentText || '').trim()
  const parentCommentId = opts.parentCommentId != null ? Number(opts.parentCommentId) : null
  const mentionedUserIds = Array.isArray(opts.mentionedUserIds) ? opts.mentionedUserIds : []

  const insert = {
    review_id: reviewId,
    user_id: userId,
    comment_text: trimmed,
    ...(parentCommentId && Number.isFinite(parentCommentId) ? { parent_comment_id: parentCommentId } : {}),
  }

  const { data, error } = await supabase
    .from('review_comments')
    .insert(insert)
    .select('id, review_id, user_id, comment_text, created_at, parent_comment_id')
    .single()
  if (error) return { success: false, error: error?.message, data: null }

  const exclude = new Set()
  if (parentCommentId && Number.isFinite(parentCommentId)) {
    void notifyParentOfReply({
      parentCommentId,
      newCommentId: data.id,
      reviewId,
      actorUserId: userId,
    })
    const { data: parent } = await supabase
      .from('review_comments')
      .select('user_id')
      .eq('id', parentCommentId)
      .maybeSingle()
    if (parent?.user_id) exclude.add(parent.user_id)
  } else {
    void notifyReviewAuthorOfComment({ commentId: data.id, reviewId, actorUserId: userId })
  }

  void notifyMentionedUsers({
    mentionedUserIds,
    commentId: data.id,
    reviewId,
    actorUserId: userId,
    excludeIds: exclude,
  })

  return { success: true, error: undefined, data }
}

export async function getCommentsWithProfiles(reviewId, viewerUserId) {
  if (!reviewId || !supabase) return []
  const { data: comments } = await supabase
    .from('review_comments')
    .select('id, review_id, user_id, comment_text, created_at, parent_comment_id')
    .eq('review_id', reviewId)
    .order('created_at', { ascending: true })
  if (!comments?.length) return []
  const userIds = [...new Set(comments.map((c) => c.user_id))]
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, avatar_url')
    .in('id', userIds)
  const byId = Object.fromEntries((profiles || []).map((p) => [p.id, p]))
  const withProfiles = comments.map((c) => ({ ...c, profile: byId[c.user_id] || null }))
  return enrichCommentsWithLikes(withProfiles, viewerUserId)
}
