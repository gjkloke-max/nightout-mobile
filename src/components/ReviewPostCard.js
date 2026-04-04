import { useState } from 'react'
import { View, Text, StyleSheet, Pressable, Image, TextInput, Platform } from 'react-native'
import { Heart, MapPin, MessageCircle } from 'lucide-react-native'
import { likeReview, unlikeReview } from '../services/reviewLikes'
import { addComment, getCommentsWithProfiles } from '../services/reviewComments'
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

export default function ReviewPostCard({ post, currentUserId, onLikeChange, onVenuePress, isLastInFeed = false }) {
  const [showComments, setShowComments] = useState(false)
  const [comments, setComments] = useState(post.comments || [])
  const [commentText, setCommentText] = useState('')
  const [likeCount, setLikeCount] = useState(post.likeCount ?? 0)
  const [liked, setLiked] = useState(!!(currentUserId && (post.likedBy || []).includes(currentUserId)))

  const venue = Array.isArray(post.venue) ? post.venue[0] : post.venue

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
        <View style={styles.headerMain}>
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
        </View>
        {post.rating10 != null ? (
          <View style={styles.ratingBadge} accessibilityLabel={`Rating ${Number(post.rating10).toFixed(1)} out of 10`}>
            <Text style={styles.ratingBadgeText}>{Number(post.rating10).toFixed(1)}</Text>
          </View>
        ) : null}
      </View>

      <Pressable style={styles.venueRow} onPress={() => onVenuePress?.(venue)}>
        <View style={styles.venueThumb}>
          {venue?.primary_photo_url ? (
            <Image source={{ uri: venue.primary_photo_url }} style={styles.venueThumbImg} />
          ) : (
            <View style={styles.venuePlaceholder}>
              <MapPin size={iconSizes.card} color={colors.textMuted} strokeWidth={1.5} />
            </View>
          )}
        </View>
        <View style={styles.venueInfo}>
          <Text style={styles.venueName}>{venue?.name || 'Venue'}</Text>
          {venue?.neighborhood_name ? <Text style={styles.venueNeighborhood}>{venue.neighborhood_name}</Text> : null}
        </View>
      </Pressable>

      {post.review_text ? <Text style={styles.reviewText}>{post.review_text}</Text> : null}

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
        <View style={styles.comments}>
          {comments.map((c) => (
            <View key={c.id} style={styles.comment}>
              <Text style={styles.commentAuthor}>{displayName(c.profile)}</Text>
              <Text style={styles.commentText}>{c.comment_text}</Text>
            </View>
          ))}
          {currentUserId ? (
            <View style={styles.commentInputRow}>
              <TextInput
                style={styles.commentInput}
                value={commentText}
                onChangeText={setCommentText}
                placeholder="Add a comment..."
                placeholderTextColor={colors.textMuted}
                onSubmitEditing={handleCommentSubmit}
              />
              <Pressable style={styles.commentSubmit} onPress={handleCommentSubmit} disabled={!commentText.trim()}>
                <Text style={styles.commentSubmitText}>Post</Text>
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
  /** White inset teaser on gray canvas */
  venueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    backgroundColor: colors.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    overflow: 'hidden',
  },
  venueThumb: {
    width: 64,
    height: 64,
    marginVertical: 8,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: colors.backgroundMuted,
    borderRadius: 6,
    backgroundColor: colors.backgroundMuted,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  venueThumbImg: { width: '100%', height: '100%' },
  venuePlaceholder: { fontSize: 24, textAlign: 'center', lineHeight: 64 },
  venueInfo: { flex: 1, paddingVertical: 12, paddingHorizontal: 8, paddingRight: 12 },
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
  actions: {
    flexDirection: 'row',
    gap: spacing.lg,
    paddingTop: 4,
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  actionText: { fontSize: fontSizes.sm, color: colors.textMuted, fontFamily: fontFamilies.inter },
  comments: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  comment: { marginBottom: spacing.sm },
  commentAuthor: { fontSize: fontSizes.sm, fontWeight: '600', color: colors.textPrimary },
  commentText: { fontSize: fontSizes.sm, color: colors.textSecondary },
  commentInputRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    fontSize: fontSizes.sm,
    color: colors.textPrimary,
  },
  commentSubmit: { justifyContent: 'center' },
  commentSubmitText: { fontSize: fontSizes.sm, color: colors.link, fontWeight: '600' },
})
