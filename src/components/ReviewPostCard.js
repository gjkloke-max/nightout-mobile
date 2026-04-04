import { useState, useEffect } from 'react'
import { View, Text, StyleSheet, Pressable, Image, TextInput, Platform } from 'react-native'
import { Heart, MessageCircle } from 'lucide-react-native'
import { likeReview, unlikeReview } from '../services/reviewLikes'
import { addComment, getCommentsWithProfiles } from '../services/reviewComments'
import { useAuth } from '../contexts/AuthContext'
import { colors, fontSizes, fontWeights, spacing, iconSizes, fontFamilies } from '../theme'

function displayName(p) {
  if (!p) return 'Anonymous'
  const parts = [p.first_name, p.last_name].filter(Boolean)
  return parts.length ? parts.join(' ') : 'Anonymous'
}

function formatTime(d) {
  if (!d) return ''
  const date = new Date(d)
  const now = new Date()
  const diffMins = Math.floor((now - date) / 60000)
  const diffHours = Math.floor((now - date) / 3600000)
  const diffDays = Math.floor((now - date) / 86400000)
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return '1 day ago'
  if (diffDays < 7) return `${diffDays} days ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** Figma — short stamps on comments */
function formatCommentTime(d) {
  if (!d) return ''
  const date = new Date(d)
  const now = new Date()
  const diffMins = Math.floor((now - date) / 60000)
  const diffHours = Math.floor((now - date) / 3600000)
  const diffDays = Math.floor((now - date) / 86400000)
  if (diffMins < 1) return 'now'
  if (diffMins < 60) return `${diffMins}m`
  if (diffHours < 24) return `${diffHours}h`
  if (diffDays === 1) return '1d'
  if (diffDays < 7) return `${diffDays}d`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function composerInitials(user) {
  const meta = user?.user_metadata
  if (meta?.first_name) return String(meta.first_name).slice(0, 2).toUpperCase()
  const email = user?.email || ''
  return email.slice(0, 2).toUpperCase() || '?'
}

export default function ReviewPostCard({
  post,
  currentUserId,
  onLikeChange,
  onVenuePress,
  onAuthorPress,
  isLastInFeed = false,
  navigation,
}) {
  const { user } = useAuth()
  const [showComments, setShowComments] = useState(false)
  const [comments, setComments] = useState(post.comments || [])
  const [commentText, setCommentText] = useState('')
  const [likeCount, setLikeCount] = useState(post.likeCount ?? 0)
  const [liked, setLiked] = useState(!!(currentUserId && (post.likedBy || []).includes(currentUserId)))

  useEffect(() => {
    setComments(post.comments || [])
  }, [post.venue_review_id, post.comments])

  const venue = Array.isArray(post.venue) ? post.venue[0] : post.venue
  const authorId = post.author?.id || post.user_id
  const authorTappable = !!(onAuthorPress && authorId && currentUserId && authorId !== currentUserId)

  const commentProfileUserId = (c) => c.user_id || c.profile?.id
  const commentTappable = (c) =>
    !!(onAuthorPress && commentProfileUserId(c) && currentUserId && commentProfileUserId(c) !== currentUserId)

  const handleLike = async () => {
    if (!currentUserId) return
    setLiked((prev) => !prev)
    setLikeCount((prev) => (liked ? prev - 1 : prev + 1))
    if (liked) {
      await unlikeReview(currentUserId, post.venue_review_id)
      onLikeChange?.(post.venue_review_id, -1)
    } else {
      await likeReview(currentUserId, post.venue_review_id)
      onLikeChange?.(post.venue_review_id, 1)
    }
  }

  const handleCommentSubmit = async () => {
    if (!currentUserId || !commentText.trim()) return
    const { success, data } = await addComment(currentUserId, post.venue_review_id, commentText)
    if (success && data) {
      setComments((prev) => [...prev, { ...data, profile: { id: currentUserId, first_name: '', last_name: '' } }])
      setCommentText('')
    }
  }

  const loadComments = async () => {
    if (!showComments && comments.length === 0) {
      const loaded = await getCommentsWithProfiles(post.venue_review_id)
      setComments(loaded)
    }
    setShowComments((prev) => !prev)
  }

  return (
    <View style={[styles.post, isLastInFeed && styles.postLast]}>
      <View style={styles.headerRow}>
        <Pressable
          style={({ pressed }) => [styles.headerMain, authorTappable && pressed && styles.headerMainPressed]}
          onPress={() => authorTappable && onAuthorPress(authorId)}
          disabled={!authorTappable}
        >
          <View style={styles.avatar}>
            {post.author?.avatar_url ? (
              <Image source={{ uri: post.author.avatar_url }} style={styles.avatarImg} />
            ) : (
              <Text style={styles.avatarText}>{displayName(post.author).slice(0, 2).toUpperCase()}</Text>
            )}
          </View>
          <View style={styles.authorInfo}>
            <Text style={styles.authorName}>{displayName(post.author)}</Text>
            <Text style={styles.time}>{formatTime(post.review_date || post.created_at)}</Text>
          </View>
        </Pressable>
        {post.rating10 != null ? (
          <View style={styles.ratingBadge} accessibilityLabel={`Rating ${Number(post.rating10).toFixed(1)} out of 10`}>
            <Text style={styles.ratingBadgeText}>{Number(post.rating10).toFixed(1)}</Text>
          </View>
        ) : null}
      </View>

      <Pressable style={styles.venueRow} onPress={() => onVenuePress?.(venue)}>
        <View style={styles.venueInfo}>
          <Text style={styles.venueName}>{venue?.name || 'Venue'}</Text>
          {venue?.neighborhood_name ? <Text style={styles.venueNeighborhood}>{venue.neighborhood_name}</Text> : null}
        </View>
      </Pressable>

      {post.review_text ? (
        <Pressable
          onPress={() => navigation?.navigate?.('SocialReviewDetail', { reviewId: post.venue_review_id })}
          style={({ pressed }) => [pressed && navigation && styles.reviewTextPressed]}
        >
          <Text style={styles.reviewText}>{post.review_text}</Text>
        </Pressable>
      ) : null}

      <View style={styles.actions}>
        <Pressable style={styles.actionBtn} onPress={handleLike}>
          <Heart
            size={iconSizes.card}
            color={liked ? colors.browseAccent : colors.textMuted}
            fill={liked ? colors.browseAccent : 'transparent'}
            strokeWidth={2}
          />
          <Text style={styles.actionText}>{likeCount}</Text>
        </Pressable>
        <Pressable style={styles.actionBtn} onPress={loadComments}>
          <MessageCircle size={iconSizes.card} color={colors.textMuted} strokeWidth={2} />
          <Text style={styles.actionText}>{comments.length}</Text>
        </Pressable>
      </View>

      {showComments ? (
        <View style={styles.commentsSection}>
          <View style={styles.commentsWarm}>
            {comments.map((c, idx) => {
              const cid = commentProfileUserId(c)
              const canOpen = commentTappable(c)
              return (
                <View
                  key={c.id}
                  style={[styles.commentRow, idx === comments.length - 1 && styles.commentRowLast]}
                >
                  <Pressable
                    style={({ pressed }) => [
                      styles.commentPressable,
                      canOpen && pressed && styles.commentPressablePressed,
                    ]}
                    onPress={() => canOpen && onAuthorPress(cid)}
                    disabled={!canOpen}
                  >
                    <View style={styles.commentAvatar}>
                      {c.profile?.avatar_url ? (
                        <Image source={{ uri: c.profile.avatar_url }} style={styles.commentAvatarImg} />
                      ) : (
                        <Text style={styles.commentAvatarText}>{displayName(c.profile).slice(0, 2).toUpperCase()}</Text>
                      )}
                    </View>
                    <View style={styles.commentMain}>
                      <View style={styles.commentMeta}>
                        <Text style={styles.commentName}>{displayName(c.profile)}</Text>
                        <Text style={styles.commentWhen}>{formatCommentTime(c.created_at)}</Text>
                      </View>
                      <Text style={styles.commentBody}>{c.comment_text}</Text>
                      <Text style={styles.commentReply}>Reply</Text>
                    </View>
                  </Pressable>
                  <View style={styles.commentLikeCol}>
                    <Heart size={14} color={colors.textSecondary} fill="transparent" strokeWidth={2} />
                    <Text style={styles.commentLikeCount}>0</Text>
                  </View>
                </View>
              )
            })}
          </View>
          {currentUserId ? (
            <View style={styles.commentsComposer}>
              <View style={styles.composerAvatar}>
                {user?.user_metadata?.avatar_url ? (
                  <Image source={{ uri: user.user_metadata.avatar_url }} style={styles.composerAvatarImg} />
                ) : (
                  <Text style={styles.composerAvatarText}>{composerInitials(user)}</Text>
                )}
              </View>
              <TextInput
                style={styles.composerInput}
                value={commentText}
                onChangeText={setCommentText}
                placeholder="Add a comment..."
                placeholderTextColor={colors.textTag}
                onSubmitEditing={handleCommentSubmit}
              />
              <Pressable onPress={handleCommentSubmit} disabled={!commentText.trim()} hitSlop={8}>
                <Text style={[styles.composerPost, !commentText.trim() && styles.composerPostDisabled]}>Post</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

const serifTime = Platform.select({ ios: 'Georgia', android: 'serif' })
const serifBody = Platform.select({ ios: 'Georgia', android: 'serif' })

const styles = StyleSheet.create({
  /** Figma: light gray canvas; hairline between posts — not a card */
  post: {
    backgroundColor: colors.backgroundCanvas,
    paddingHorizontal: spacing.xl,
    paddingTop: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  postLast: {
    borderBottomWidth: 0,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  headerMain: { flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0, paddingRight: spacing.sm },
  headerMainPressed: { opacity: 0.88 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarText: {
    fontSize: 10,
    fontFamily: fontFamilies.interBold,
    fontWeight: fontWeights.bold,
    color: colors.textSecondary,
  },
  authorInfo: { marginLeft: spacing.base },
  authorName: {
    fontSize: 10,
    fontFamily: fontFamilies.interBold,
    fontWeight: fontWeights.bold,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.textPrimary,
    lineHeight: 12,
  },
  time: {
    fontSize: 10,
    fontFamily: serifTime,
    fontStyle: 'italic',
    color: colors.textSecondary,
    lineHeight: 12,
    marginTop: 4,
  },
  ratingBadge: {
    borderWidth: 1,
    borderColor: colors.browseAccentBorder,
    backgroundColor: colors.browseAccent,
    paddingHorizontal: 11,
    paddingVertical: 5,
    alignSelf: 'flex-start',
    borderRadius: 4,
  },
  ratingBadgeText: {
    fontFamily: fontFamilies.fraunces,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textOnDark,
    letterSpacing: -0.3,
  },
  /** White inset teaser on gray canvas (text only — no venue photo on feed) */
  venueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    overflow: 'hidden',
  },
  venueInfo: { flex: 1, minWidth: 0 },
  venueName: {
    fontSize: 18,
    fontFamily: fontFamilies.frauncesSemiBold,
    color: colors.textPrimary,
    lineHeight: 23,
  },
  venueNeighborhood: {
    fontSize: 10,
    fontFamily: fontFamilies.interBold,
    fontWeight: fontWeights.bold,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.textSecondary,
    lineHeight: 12,
    marginTop: 4,
  },
  reviewText: {
    fontSize: 18,
    fontFamily: serifBody,
    color: '#27272a',
    lineHeight: 29.25,
    marginBottom: spacing.md,
  },
  reviewTextPressed: {
    opacity: 0.85,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.lg,
    paddingTop: 4,
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  actionText: { fontSize: fontSizes.sm, color: colors.textMuted, fontFamily: fontFamilies.inter },
  commentsSection: {
    marginHorizontal: -spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  commentsWarm: {
    backgroundColor: '#fdfbf7',
    paddingHorizontal: spacing.xl,
    paddingTop: 32,
    paddingBottom: 24,
  },
  commentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    marginBottom: 32,
  },
  commentRowLast: { marginBottom: 0 },
  commentPressable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    minWidth: 0,
  },
  commentPressablePressed: { opacity: 0.88 },
  commentAvatar: {
    width: 32,
    height: 32,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 2,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentAvatarImg: { width: '100%', height: '100%' },
  commentAvatarText: {
    fontSize: 9,
    fontFamily: fontFamilies.interBold,
    fontWeight: fontWeights.bold,
    color: colors.textSecondary,
  },
  commentMain: { flex: 1, minWidth: 0 },
  commentMeta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 4 },
  commentName: {
    fontSize: 10,
    fontFamily: fontFamilies.interBold,
    fontWeight: fontWeights.bold,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.textPrimary,
  },
  commentWhen: {
    fontSize: 10,
    fontFamily: serifTime,
    fontStyle: 'italic',
    color: colors.textSecondary,
  },
  commentBody: {
    fontSize: 14,
    fontFamily: serifBody,
    lineHeight: 22.75,
    color: '#3f3f47',
    marginBottom: 8,
  },
  commentReply: {
    fontSize: 10,
    fontFamily: fontFamilies.interBold,
    fontWeight: fontWeights.bold,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.textTag,
  },
  commentLikeCol: { alignItems: 'center', gap: 4, paddingTop: 4, width: 14 },
  commentLikeCount: {
    fontSize: 10,
    fontFamily: fontFamilies.interBold,
    fontWeight: fontWeights.bold,
    color: colors.textTag,
  },
  commentsComposer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: spacing.xl,
    paddingVertical: 16,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.backgroundCanvas,
  },
  composerAvatar: {
    width: 32,
    height: 32,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 2,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerAvatarImg: { width: '100%', height: '100%' },
  composerAvatarText: {
    fontSize: 9,
    fontFamily: fontFamilies.interBold,
    fontWeight: fontWeights.bold,
    color: colors.textSecondary,
  },
  composerInput: {
    flex: 1,
    minWidth: 0,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderInput,
    paddingVertical: 8,
    fontSize: 14,
    fontFamily: fontFamilies.interMedium,
    fontWeight: fontWeights.medium,
    color: colors.textPrimary,
  },
  composerPost: {
    fontSize: 12,
    fontFamily: fontFamilies.interBold,
    fontWeight: fontWeights.bold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: '#a50036',
  },
  composerPostDisabled: { opacity: 0.45 },
})
