import { useState } from 'react'
import { View, Text, StyleSheet, Pressable, Image, TextInput } from 'react-native'
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
  if (diffDays < 7) return `${diffDays}d ago`
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
    <View style={[styles.card, isLastInFeed && styles.cardLast]}>
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
            color={liked ? colors.error : colors.textMuted}
            fill={liked ? colors.error : 'transparent'}
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

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.backgroundElevated,
    borderRadius: 12,
    padding: spacing.xl,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.xl,
  },
  cardLast: {
    marginBottom: 0,
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
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarText: { fontSize: fontSizes.xs, color: colors.textMuted },
  authorInfo: { marginLeft: spacing.base },
  authorName: {
    fontSize: fontSizes.sm,
    fontFamily: fontFamilies.interSemiBold,
    color: colors.textPrimary,
    lineHeight: 15,
  },
  time: { fontSize: fontSizes.xs, color: colors.textMuted, lineHeight: 15, marginTop: 4 },
  ratingBadge: {
    borderWidth: 1.33,
    borderColor: colors.browseAccentBorder,
    backgroundColor: colors.browseAccent,
    paddingHorizontal: 11,
    paddingVertical: 5,
    alignSelf: 'flex-start',
  },
  ratingBadgeText: {
    fontFamily: fontFamilies.fraunces,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textOnDark,
    letterSpacing: -0.3,
  },
  venueRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md, backgroundColor: colors.surface, borderRadius: 8, overflow: 'hidden' },
  venueThumb: { width: 64, height: 64, backgroundColor: colors.surfaceLight, alignItems: 'center', justifyContent: 'center' },
  venueThumbImg: { width: '100%', height: '100%' },
  venuePlaceholder: { fontSize: 24, textAlign: 'center', lineHeight: 64 },
  venueInfo: { flex: 1, paddingVertical: spacing.md, paddingHorizontal: spacing.sm },
  venueName: {
    fontSize: fontSizes.base,
    fontFamily: fontFamilies.interSemiBold,
    color: colors.textPrimary,
    lineHeight: 23,
  },
  venueNeighborhood: { fontSize: fontSizes.xs, color: colors.textMuted, lineHeight: 15, marginTop: 4 },
  reviewText: { fontSize: fontSizes.sm, color: colors.textSecondary, lineHeight: 22, marginBottom: spacing.md },
  actions: { flexDirection: 'row', gap: spacing.lg },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  actionText: { fontSize: fontSizes.sm, color: colors.textMuted },
  comments: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.borderLight },
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
