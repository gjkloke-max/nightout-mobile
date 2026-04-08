import { useState, useEffect, useMemo } from 'react'
import { View, Text, StyleSheet, Pressable, Image, Platform } from 'react-native'
import { Heart, MessageCircle } from 'lucide-react-native'
import { likeReview, unlikeReview } from '../services/reviewLikes'
import VenuePhotoViewer from './VenueProfile/VenuePhotoViewer'
import { venueFeedThumbUrl } from '../utils/venueFeedThumb'
import { colors, fontSizes, fontWeights, spacing, iconSizes, fontFamilies, androidRipple, pressOpacity, hitSlop } from '../theme'

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

export default function ReviewPostCard({
  post,
  currentUserId,
  onLikeChange,
  onVenuePress,
  onAuthorPress,
  isLastInFeed = false,
  navigation,
}) {
  const [likeCount, setLikeCount] = useState(post.likeCount ?? 0)
  const [liked, setLiked] = useState(!!(currentUserId && (post.likedBy || []).includes(currentUserId)))
  const [photoViewerOpen, setPhotoViewerOpen] = useState(false)
  const [photoIndex, setPhotoIndex] = useState(0)

  useEffect(() => {
    setLikeCount(post.likeCount ?? 0)
    setLiked(!!(currentUserId && (post.likedBy || []).includes(currentUserId)))
  }, [post.venue_review_id, post.likeCount, post.likedBy, currentUserId])

  const commentCount = (post.comments || []).length

  const venue = Array.isArray(post.venue) ? post.venue[0] : post.venue
  const venueThumb = venueFeedThumbUrl(venue)
  const photos = useMemo(
    () => [...(post.photos || [])].sort((a, b) => Number(a.id ?? 0) - Number(b.id ?? 0)),
    [post.photos, post.venue_review_id]
  )
  const authorId = post.author?.id || post.user_id
  const authorTappable = !!(onAuthorPress && authorId && currentUserId && authorId !== currentUserId)

  const goToReviewDetail = () => {
    navigation?.navigate?.('SocialReviewDetail', { reviewId: post.venue_review_id })
  }

  const handleLike = async () => {
    if (!currentUserId) return
    const next = !liked
    setLiked(next)
    setLikeCount((c) => (next ? c + 1 : Math.max(0, c - 1)))
    if (next) {
      await likeReview(currentUserId, post.venue_review_id)
      onLikeChange?.(post.venue_review_id, 1)
    } else {
      await unlikeReview(currentUserId, post.venue_review_id)
      onLikeChange?.(post.venue_review_id, -1)
    }
  }

  return (
    <View style={[styles.post, isLastInFeed && styles.postLast]}>
      <View style={styles.headerRow}>
        <Pressable
          style={({ pressed }) => [styles.headerMain, authorTappable && pressed && styles.headerMainPressed]}
          onPress={() => authorTappable && onAuthorPress(authorId)}
          disabled={!authorTappable}
          android_ripple={Platform.OS === 'android' ? androidRipple.light : undefined}
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

      <Pressable
        style={styles.venueRow}
        onPress={() => onVenuePress?.(venue)}
        android_ripple={Platform.OS === 'android' ? androidRipple.light : undefined}
      >
        <View style={styles.venueThumb}>
          {venueThumb ? (
            <Image source={{ uri: venueThumb }} style={styles.venueThumbImg} resizeMode="cover" />
          ) : (
            <View style={[styles.venueThumbImg, styles.venueThumbEmpty]} />
          )}
        </View>
        <View style={styles.venueInfo}>
          <Text style={styles.venueName}>{venue?.name || 'Venue'}</Text>
          {venue?.neighborhood_name ? <Text style={styles.venueNeighborhood}>{venue.neighborhood_name}</Text> : null}
        </View>
      </Pressable>

      {post.review_text ? (
        <Pressable
          onPress={goToReviewDetail}
          style={({ pressed }) => [pressed && navigation && styles.reviewTextPressed]}
          android_ripple={Platform.OS === 'android' ? androidRipple.light : undefined}
        >
          <Text style={styles.reviewText}>{post.review_text}</Text>
        </Pressable>
      ) : null}

      {photos.length > 0 ? (
        <View style={styles.reviewPhotos}>
          {photos.map((p, i) => (
            <Pressable
              key={p.id != null ? String(p.id) : `rp-${i}`}
              style={styles.reviewPhotoCell}
              onPress={() => {
                setPhotoIndex(i)
                setPhotoViewerOpen(true)
              }}
            >
              <Image source={{ uri: p.photo_url }} style={styles.reviewPhotoImg} resizeMode="cover" />
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [styles.actionBtn, pressed && { opacity: pressOpacity.default }]}
          onPress={handleLike}
          hitSlop={hitSlop.sm}
          android_ripple={Platform.OS === 'android' ? androidRipple.light : undefined}
        >
          <Heart
            size={iconSizes.card}
            color={liked ? colors.browseAccent : colors.textMuted}
            fill={liked ? colors.browseAccent : 'transparent'}
            strokeWidth={2}
          />
          <Text style={styles.actionText}>{likeCount}</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.actionBtn, pressed && { opacity: pressOpacity.default }]}
          onPress={goToReviewDetail}
          hitSlop={hitSlop.sm}
          android_ripple={Platform.OS === 'android' ? androidRipple.light : undefined}
        >
          <MessageCircle size={iconSizes.card} color={colors.textMuted} strokeWidth={2} />
          <Text style={styles.actionText}>{commentCount}</Text>
        </Pressable>
      </View>

      {photoViewerOpen && photos.length > 0 ? (
        <VenuePhotoViewer
          photos={photos.map((x) => x.photo_url)}
          initialIndex={photoIndex}
          onClose={() => setPhotoViewerOpen(false)}
        />
      ) : null}
    </View>
  )
}

const serifTime = Platform.select({ ios: 'Georgia', android: 'serif' })
const serifBody = Platform.select({ ios: 'Georgia', android: 'serif' })

const styles = StyleSheet.create({
  post: {
    backgroundColor: colors.backgroundCanvas,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
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
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarText: {
    fontSize: fontSizes.meta,
    fontFamily: fontFamilies.interBold,
    fontWeight: fontWeights.bold,
    color: colors.textSecondary,
  },
  authorInfo: { marginLeft: spacing.base },
  authorName: {
    fontSize: fontSizes.meta,
    fontFamily: fontFamilies.interBold,
    fontWeight: fontWeights.bold,
    letterSpacing: 0.75,
    textTransform: 'uppercase',
    color: colors.textPrimary,
    lineHeight: 14,
  },
  time: {
    fontSize: fontSizes.xs,
    fontFamily: serifTime,
    fontStyle: 'italic',
    color: colors.textSecondary,
    lineHeight: 16,
    marginTop: 2,
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
  venueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: spacing.md,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    overflow: 'hidden',
  },
  venueThumb: {
    width: 64,
    height: 64,
    flexShrink: 0,
    overflow: 'hidden',
    backgroundColor: colors.backgroundMuted,
  },
  venueThumbImg: { width: '100%', height: '100%' },
  venueThumbEmpty: { backgroundColor: colors.borderInput },
  venueInfo: { flex: 1, minWidth: 0 },
  venueName: {
    fontSize: 18,
    fontFamily: fontFamilies.frauncesSemiBold,
    color: colors.textPrimary,
    lineHeight: 23,
  },
  venueNeighborhood: {
    fontSize: fontSizes.meta,
    fontFamily: fontFamilies.interBold,
    fontWeight: fontWeights.bold,
    letterSpacing: 0.75,
    textTransform: 'uppercase',
    color: colors.textSecondary,
    lineHeight: 14,
    marginTop: 2,
  },
  reviewText: {
    fontSize: fontSizes.lg,
    fontFamily: serifBody,
    color: '#27272a',
    lineHeight: 28,
    marginBottom: spacing.md,
  },
  reviewTextPressed: {
    opacity: 0.85,
  },
  reviewPhotos: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: spacing.md,
  },
  reviewPhotoCell: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: colors.backgroundMuted,
  },
  reviewPhotoImg: { width: '100%', height: '100%' },
  actions: {
    flexDirection: 'row',
    gap: spacing.lg,
    paddingTop: spacing.xs,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 44,
    paddingVertical: spacing.sm,
    paddingRight: spacing.sm,
  },
  actionText: { fontSize: fontSizes.sm, color: colors.textMuted, fontFamily: fontFamilies.inter, lineHeight: 20 },
})
