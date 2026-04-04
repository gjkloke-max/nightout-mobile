import { useCallback, useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  TextInput,
  ActivityIndicator,
  Share,
  Platform,
} from 'react-native'
import { useRoute, useNavigation } from '@react-navigation/native'
import { Heart, MessageCircle, ChevronLeft, Share2 } from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '../contexts/AuthContext'
import { getSocialReviewById } from '../services/socialFeed'
import { likeReview, unlikeReview } from '../services/reviewLikes'
import { addComment } from '../services/reviewComments'
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

const serifTime = Platform.select({ ios: 'Georgia', android: 'serif' })
const serifBody = Platform.select({ ios: 'Georgia', android: 'serif' })

export default function SocialReviewDetailScreen() {
  const route = useRoute()
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const reviewId = route.params?.reviewId
  const scrollRef = useRef(null)
  const [commentsY, setCommentsY] = useState(0)
  const [post, setPost] = useState(null)
  const [loading, setLoading] = useState(true)
  const [likeCount, setLikeCount] = useState(0)
  const [liked, setLiked] = useState(false)
  const [comments, setComments] = useState([])
  const [commentText, setCommentText] = useState('')

  const load = useCallback(async () => {
    if (!user?.id || reviewId == null) {
      setLoading(false)
      return
    }
    setLoading(true)
    const data = await getSocialReviewById(user.id, reviewId)
    setPost(data)
    if (data) {
      setLikeCount(data.likeCount ?? 0)
      setLiked(!!(user.id && (data.likedBy || []).includes(user.id)))
      setComments(data.comments || [])
    }
    setLoading(false)
  }, [user?.id, reviewId])

  useEffect(() => {
    load()
  }, [load])

  const handleLike = async () => {
    if (!user?.id || !post) return
    const next = !liked
    setLiked(next)
    setLikeCount((c) => (next ? c + 1 : c - 1))
    if (liked) {
      await unlikeReview(user.id, post.venue_review_id)
    } else {
      await likeReview(user.id, post.venue_review_id)
    }
  }

  const handleCommentSubmit = async () => {
    if (!user?.id || !post || !commentText.trim()) return
    const { success, data } = await addComment(user.id, post.venue_review_id, commentText.trim())
    if (success && data) {
      setComments((prev) => [...prev, { ...data, profile: { id: user.id, first_name: '', last_name: '' } }])
      setCommentText('')
    }
  }

  const openVenue = (venue) => {
    const root = navigation.getParent()?.getParent?.()
    root?.navigate?.('VenueProfile', { venueId: venue?.venue_id })
  }

  const shareReview = async () => {
    if (!post) return
    const msg = post.venue?.name ? `Review — ${post.venue.name}` : 'Review'
    try {
      await Share.share({ message: msg })
    } catch {
      /* ignore */
    }
  }

  const scrollToComments = () => {
    scrollRef.current?.scrollTo({ y: Math.max(0, commentsY - 8), animated: true })
  }

  if (loading) {
    return (
      <View style={[styles.page, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable style={styles.headerBtn} onPress={() => navigation.goBack()} hitSlop={12}>
            <ChevronLeft size={22} color={colors.textPrimary} strokeWidth={2} />
          </Pressable>
          <Text style={styles.headerTitle}>Review</Text>
          <View style={styles.headerBtnPlaceholder} />
        </View>
        <View style={styles.center}>
          <ActivityIndicator color={colors.browseAccent} />
        </View>
      </View>
    )
  }

  if (!post) {
    return (
      <View style={[styles.page, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable style={styles.headerBtn} onPress={() => navigation.goBack()} hitSlop={12}>
            <ChevronLeft size={22} color={colors.textPrimary} strokeWidth={2} />
          </Pressable>
          <Text style={styles.headerTitle}>Review</Text>
          <View style={styles.headerBtnPlaceholder} />
        </View>
        <Text style={styles.emptyText}>Review not found or you don't have access.</Text>
      </View>
    )
  }

  const venue = Array.isArray(post.venue) ? post.venue[0] : post.venue

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable style={styles.headerBtn} onPress={() => navigation.goBack()} hitSlop={12}>
          <ChevronLeft size={22} color={colors.textPrimary} strokeWidth={2} />
        </Pressable>
        <Text style={styles.headerTitle}>Review</Text>
        <Pressable style={styles.headerBtn} onPress={shareReview} hitSlop={12}>
          <Share2 size={20} color={colors.textPrimary} strokeWidth={2} />
        </Pressable>
      </View>

      <ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.topBlock}>
          <View style={styles.heroLeft}>
            <View style={styles.authorRow}>
              <View style={styles.headerMain}>
                <View style={styles.avatarLg}>
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
                <View style={styles.ratingBadgeLg} accessibilityLabel={`Rating ${Number(post.rating10).toFixed(1)} out of 10`}>
                  <Text style={styles.ratingBadgeLgText}>{Number(post.rating10).toFixed(1)}</Text>
                </View>
              ) : null}
            </View>

            <Pressable style={styles.venueInline} onPress={() => openVenue(venue)}>
              <Text style={styles.venueNameLg}>{venue?.name || 'Venue'}</Text>
              {venue?.neighborhood_name ? <Text style={styles.venueNeighborhood}>{venue.neighborhood_name}</Text> : null}
            </Pressable>
          </View>

          {post.review_text ? <Text style={styles.reviewTextLg}>{post.review_text}</Text> : null}

          <View style={styles.actionsRow}>
            <Pressable style={styles.actionBtn} onPress={handleLike}>
              <Heart
                size={iconSizes.card}
                color={liked || likeCount > 0 ? '#ec003f' : colors.textMuted}
                fill={liked ? '#ec003f' : 'transparent'}
                strokeWidth={2}
              />
              <Text style={[styles.actionText, (liked || likeCount > 0) && styles.actionTextLiked]}>
                {likeCount > 0 ? likeCount : 'Like'}
              </Text>
            </Pressable>
            <Pressable style={styles.actionBtn} onPress={scrollToComments}>
              <MessageCircle size={iconSizes.card} color={colors.textMuted} strokeWidth={2} />
              <Text style={styles.actionText}>{comments.length > 0 ? comments.length : 'Comment'}</Text>
            </Pressable>
          </View>
        </View>

        <View
          style={styles.commentsBlock}
          onLayout={(e) => setCommentsY(e.nativeEvent.layout.y)}
          collapsable={false}
        >
          <View style={styles.commentsWarm}>
            {comments.map((c, idx) => (
              <View key={c.id} style={[styles.commentRow, idx === comments.length - 1 && styles.commentRowLast]}>
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
                <View style={styles.commentLikeCol}>
                  <Heart size={14} color={colors.textSecondary} fill="transparent" strokeWidth={2} />
                  <Text style={styles.commentLikeCount}>0</Text>
                </View>
              </View>
            ))}
          </View>
          {user?.id ? (
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
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.backgroundCanvas,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 56,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 2,
    borderBottomColor: colors.border,
    backgroundColor: colors.backgroundCanvas,
  },
  headerBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderInput,
    borderRadius: 4,
    backgroundColor: colors.backgroundCanvas,
  },
  headerBtnPlaceholder: { width: 36, height: 36 },
  headerTitle: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontFamily: fontFamilies.interBold,
    fontWeight: fontWeights.bold,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.textPrimary,
    pointerEvents: 'none',
  },
  emptyText: {
    padding: spacing.xl,
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: fontSizes.md,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: spacing.xxl },
  topBlock: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    backgroundColor: colors.backgroundCanvas,
  },
  heroLeft: {
    marginBottom: spacing.md,
    gap: 8,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 0,
  },
  headerMain: { flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0, paddingRight: spacing.sm },
  avatarLg: {
    width: 48,
    height: 48,
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
    fontSize: 11,
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
  },
  time: {
    fontSize: 10,
    fontFamily: serifTime,
    fontStyle: 'italic',
    color: colors.textSecondary,
    marginTop: 4,
  },
  ratingBadgeLg: {
    borderWidth: 1,
    borderColor: colors.browseAccentBorder,
    backgroundColor: colors.browseAccent,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  ratingBadgeLgText: {
    fontFamily: fontFamilies.fraunces,
    fontSize: 14,
    lineHeight: 18,
    color: colors.textOnDark,
  },
  venueInline: {
    alignSelf: 'stretch',
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  venueNameLg: {
    fontSize: 20,
    fontFamily: fontFamilies.frauncesSemiBold,
    color: colors.textPrimary,
    lineHeight: 25,
  },
  venueNeighborhood: {
    fontSize: 10,
    fontFamily: fontFamilies.interBold,
    fontWeight: fontWeights.bold,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.textSecondary,
    marginTop: 4,
  },
  reviewTextLg: {
    fontSize: 20,
    fontFamily: fontFamilies.frauncesRegular,
    color: '#27272a',
    lineHeight: 30,
    marginBottom: spacing.md,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginHorizontal: -spacing.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: 0,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  actionText: { fontSize: fontSizes.sm, color: colors.textMuted, fontFamily: fontFamilies.inter },
  actionTextLiked: { color: '#ec003f', fontWeight: '600' },
  commentsBlock: {
    marginHorizontal: 0,
    borderTopWidth: 0,
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
