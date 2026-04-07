/**
 * Social notification entry points — keep aligned with NightOut web `notificationHandlers.js`.
 */

import { createOrAggregateNotification } from './notifications'

export async function onFollowCreated(ctx) {
  const { followerId, followedId, actorDisplayName } = ctx
  if (!followerId || !followedId || followerId === followedId) return { skipped: true }
  return createOrAggregateNotification({
    recipientUserId: followedId,
    type: 'user_followed_you',
    actorUserId: followerId,
    entityType: 'profile',
    entityId: followerId,
    skipIfSelf: true,
    metadata: { actor_display_name: actorDisplayName },
    body: actorDisplayName ? `${actorDisplayName} started following you` : undefined,
  })
}

export async function onFollowRequestCreated(ctx) {
  const { targetUserId, requesterId, requestId, requesterName, requesterAvatarUrl } = ctx
  if (!targetUserId || !requesterId || targetUserId === requesterId) return { skipped: true }
  return createOrAggregateNotification({
    recipientUserId: targetUserId,
    type: 'follow_request_received',
    actorUserId: requesterId,
    entityType: 'follow_request',
    entityId: String(requestId),
    actionType: 'follow_request_inline',
    metadata: {
      requester_user_id: requesterId,
      requester_name: requesterName,
      requester_avatar_url: requesterAvatarUrl,
    },
    body: requesterName ? `${requesterName} sent you a follow request` : undefined,
  })
}

export async function onFollowRequestAccepted(ctx) {
  const { requesterUserId, targetUserId, targetName, targetAvatarUrl } = ctx
  if (!requesterUserId || !targetUserId) return { skipped: true }
  return createOrAggregateNotification({
    recipientUserId: requesterUserId,
    type: 'follow_request_accepted',
    actorUserId: targetUserId,
    entityType: 'profile',
    entityId: targetUserId,
    metadata: {
      target_user_id: targetUserId,
      target_name: targetName,
      target_avatar_url: targetAvatarUrl,
    },
    body: targetName ? `${targetName} accepted your follow request` : undefined,
  })
}

export async function onFollowRequestDeclined(ctx) {
  const { requesterUserId, targetUserId, targetName, targetAvatarUrl } = ctx
  if (!requesterUserId || !targetUserId) return { skipped: true }
  return createOrAggregateNotification({
    recipientUserId: requesterUserId,
    type: 'follow_request_declined',
    actorUserId: targetUserId,
    entityType: 'profile',
    entityId: targetUserId,
    metadata: {
      target_user_id: targetUserId,
      target_name: targetName,
      target_avatar_url: targetAvatarUrl,
    },
    body: targetName ? `${targetName} declined your follow request` : undefined,
  })
}

export async function onReviewCommented(ctx) {
  const { recipientUserId, actorUserId, reviewId, commentId, actorName } = ctx
  if (!recipientUserId || !actorUserId) return { skipped: true }
  return createOrAggregateNotification({
    recipientUserId,
    type: 'post_commented',
    actorUserId,
    entityType: 'venue_review',
    entityId: String(reviewId),
    skipIfSelf: true,
    metadata: {
      actor_display_name: actorName,
      comment_id: String(commentId),
      review_id: String(reviewId),
      entity_label: 'your post',
    },
    body: actorName ? `${actorName} commented on your post` : undefined,
  })
}

export async function onReviewLiked(ctx) {
  const { recipientUserId, actorUserId, reviewId, actorName } = ctx
  if (!recipientUserId || !actorUserId) return { skipped: true }
  return createOrAggregateNotification({
    recipientUserId,
    type: 'post_liked',
    actorUserId,
    entityType: 'venue_review',
    entityId: String(reviewId),
    skipIfSelf: true,
    metadata: { actor_display_name: actorName, entity_label: 'your post' },
    body: actorName ? `${actorName} liked your post` : undefined,
  })
}

/** @param {{ recipientUserId: string, actorUserId: string, commentId: string, reviewId: string, actorName?: string }} ctx */
export async function onCommentLiked(ctx) {
  return createOrAggregateNotification({
    recipientUserId: ctx.recipientUserId,
    type: 'comment_liked',
    actorUserId: ctx.actorUserId,
    entityType: 'review_comment',
    entityId: ctx.commentId,
    parentEntityType: 'venue_review',
    parentEntityId: ctx.reviewId,
    skipIfSelf: true,
    metadata: { actor_display_name: ctx.actorName, entity_label: 'your comment', review_id: ctx.reviewId },
  })
}

/** @param {{ recipientUserId: string, actorUserId: string, commentId: string, reviewId: string, actorName?: string }} ctx */
export async function onCommentReplyCreated(ctx) {
  return createOrAggregateNotification({
    recipientUserId: ctx.recipientUserId,
    type: 'comment_replied',
    actorUserId: ctx.actorUserId,
    entityType: 'review_comment',
    entityId: ctx.commentId,
    parentEntityType: 'venue_review',
    parentEntityId: ctx.reviewId,
    skipIfSelf: true,
    metadata: { actor_display_name: ctx.actorName, review_id: ctx.reviewId },
  })
}

/** @param {{ recipientUserId: string, actorUserId: string, commentId: string, reviewId: string, actorName?: string }} ctx */
export async function onCommentMentioned(ctx) {
  return createOrAggregateNotification({
    recipientUserId: ctx.recipientUserId,
    type: 'mentioned_in_comment',
    actorUserId: ctx.actorUserId,
    entityType: 'review_comment',
    entityId: ctx.commentId,
    parentEntityType: 'venue_review',
    parentEntityId: ctx.reviewId,
    skipIfSelf: true,
    metadata: { actor_display_name: ctx.actorName, review_id: ctx.reviewId },
  })
}

export async function onVenueReviewMentioned(ctx) {
  const { recipientUserId, actorUserId, reviewId, actorName } = ctx
  if (!recipientUserId || !actorUserId || reviewId == null) return { skipped: true }
  return createOrAggregateNotification({
    recipientUserId,
    type: 'mentioned_in_post',
    actorUserId,
    entityType: 'venue_review',
    entityId: String(reviewId),
    skipIfSelf: true,
    metadata: { actor_display_name: actorName, review_id: String(reviewId) },
    body: actorName ? `${actorName} mentioned you in a post` : undefined,
  })
}
