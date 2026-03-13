import { useState } from 'react'
import { View, Text, StyleSheet, Pressable, Image, TextInput } from 'react-native'
import { likeReview, unlikeReview } from '../services/reviewLikes'
import { addComment, getCommentsWithProfiles } from '../services/reviewComments'
import { colors, fontSizes, fontWeights, spacing } from '../theme'

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

export default function ReviewPostCard({ post, currentUserId, onLikeChange, onVenuePress }) {
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
    <View style={styles.card}>
      <View style={styles.header}>
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

      <Pressable style={styles.venueRow} onPress={() => onVenuePress?.(venue)}>
        <View style={styles.venueThumb}>
          {venue?.primary_photo_url ? (
            <Image source={{ uri: venue.primary_photo_url }} style={styles.venueThumbImg} />
          ) : (
            <Text style={styles.venuePlaceholder}>📍</Text>
          )}
        </View>
        <View style={styles.venueInfo}>
          <Text style={styles.venueName}>{venue?.name || 'Venue'}</Text>
          {venue?.neighborhood_name ? <Text style={styles.venueNeighborhood}>{venue.neighborhood_name}</Text> : null}
        </View>
      </Pressable>

      {post.rating10 != null ? (
        <Text style={styles.rating}>{Number(post.rating10).toFixed(1)}/10</Text>
      ) : null}
      {post.review_text ? <Text style={styles.reviewText}>{post.review_text}</Text> : null}

      <View style={styles.actions}>
        <Pressable style={styles.actionBtn} onPress={handleLike}>
          <Text style={styles.actionIcon}>{liked ? '❤️' : '♡'}</Text>
          <Text style={styles.actionText}>{likeCount}</Text>
        </Pressable>
        <Pressable style={styles.actionBtn} onPress={loadComments}>
          <Text style={styles.actionIcon}>💬</Text>
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
    padding: spacing.base,
    marginBottom: spacing.base,
  },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
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
  authorInfo: { marginLeft: spacing.sm },
  authorName: { fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  time: { fontSize: fontSizes.xs, color: colors.textMuted },
  venueRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm, backgroundColor: colors.surface, borderRadius: 8, overflow: 'hidden' },
  venueThumb: { width: 56, height: 56, backgroundColor: colors.surfaceLight },
  venueThumbImg: { width: '100%', height: '100%' },
  venuePlaceholder: { fontSize: 24, textAlign: 'center', lineHeight: 56 },
  venueInfo: { flex: 1, padding: spacing.sm },
  venueName: { fontSize: fontSizes.sm, fontWeight: fontWeights.medium, color: colors.textPrimary },
  venueNeighborhood: { fontSize: fontSizes.xs, color: colors.textMuted },
  rating: { fontSize: fontSizes.sm, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.xs },
  reviewText: { fontSize: fontSizes.sm, color: colors.textSecondary, lineHeight: 22, marginBottom: spacing.md },
  actions: { flexDirection: 'row', gap: spacing.lg },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  actionIcon: { fontSize: 18 },
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
