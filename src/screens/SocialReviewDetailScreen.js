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
  Platform,
  KeyboardAvoidingView,
  Keyboard,
} from 'react-native'
import { useRoute, useNavigation } from '@react-navigation/native'
import { Heart, MessageCircle, ChevronLeft } from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { getSocialReviewById } from '../services/socialFeed'
import { likeReview, unlikeReview } from '../services/reviewLikes'
import { addComment } from '../services/reviewComments'
import { toggleCommentLike } from '../services/commentLikes'
import { searchUsersForMention } from '../services/userSearch'
import { resolveMentionedUserIds } from '../services/mentionResolve'
import MentionText from '../components/MentionText'
import { colors, fontSizes, fontWeights, spacing, iconSizes, fontFamilies, androidRipple } from '../theme'

function displayName(p) {
  if (!p) return 'Anonymous'
  const parts = [p.first_name, p.last_name].filter(Boolean)
  return parts.length ? parts.join(' ') : 'Anonymous'
}

function displayNameForMention(p) {
  if (!p) return ''
  const parts = [p.first_name, p.last_name].filter(Boolean)
  return parts.length ? parts.join(' ') : ''
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
  const [replyParentId, setReplyParentId] = useState(null)
  const [mentionOpen, setMentionOpen] = useState(false)
  const [mentionFilter, setMentionFilter] = useState('')
  const [mentionResults, setMentionResults] = useState([])
  const [mentionPickIds, setMentionPickIds] = useState(() => new Set())
  const mentionDebounce = useRef(null)
  /** Current user's profile row — used for composer avatar and optimistic comment names */
  const [myProfile, setMyProfile] = useState(null)

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

  useEffect(() => {
    if (!user?.id || !supabase) {
      setMyProfile(null)
      return
    }
    let cancelled = false
    supabase
      .from('profiles')
      .select('first_name, last_name, avatar_url, username')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setMyProfile(data ?? null)
      })
    return () => {
      cancelled = true
    }
  }, [user?.id])

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

  const runMentionSearch = useCallback(async (q) => {
    if (!user?.id || !q.length) {
      setMentionResults([])
      return
    }
    const rows = await searchUsersForMention(user.id, q, 10)
    setMentionResults(rows || [])
  }, [user?.id])

  useEffect(() => {
    if (!mentionOpen || !user?.id) return
    if (mentionDebounce.current) clearTimeout(mentionDebounce.current)
    mentionDebounce.current = setTimeout(() => {
      void runMentionSearch(mentionFilter)
    }, 200)
    return () => {
      if (mentionDebounce.current) clearTimeout(mentionDebounce.current)
    }
  }, [mentionFilter, mentionOpen, user?.id, runMentionSearch])

  const onCommentTextChange = (v) => {
    setCommentText(v)
    const at = v.lastIndexOf('@')
    if (at >= 0 && user?.id) {
      const after = v.slice(at + 1)
      if (!after.includes(' ') && !after.includes('\n')) {
        setMentionFilter(after)
        setMentionOpen(true)
        return
      }
    }
    setMentionOpen(false)
  }

  const pickCommentMention = (profile) => {
    const at = commentText.lastIndexOf('@')
    if (at < 0 || !profile?.id) return
    const un = (profile.username || '').toLowerCase()
    if (!un) return
    const before = commentText.slice(0, at)
    setCommentText(`${before}@${un} `)
    setMentionPickIds((prev) => new Set(prev).add(String(profile.id)))
    setMentionOpen(false)
    setMentionFilter('')
  }

  const handleCommentSubmit = async () => {
    if (!user?.id || !post || !commentText.trim()) return
    const mentionedUserIds = await resolveMentionedUserIds(commentText, [...mentionPickIds])
    const { success } = await addComment(user.id, post.venue_review_id, commentText.trim(), {
      parentCommentId: replyParentId,
      mentionedUserIds: mentionedUserIds.length ? mentionedUserIds : undefined,
    })
    if (success) {
      setCommentText('')
      setReplyParentId(null)
      setMentionPickIds(new Set())
      setMentionOpen(false)
      Keyboard.dismiss()
      await load()
      requestAnimationFrame(() => {
        scrollRef.current?.scrollToEnd({ animated: true })
      })
    }
  }

  const handleToggleCommentLike = async (c) => {
    if (!user?.id || !post) return
    const prevCount = c.likeCount ?? 0
    const prevLiked = !!c.likedByViewer
    const nextLiked = !prevLiked
    const nextCount = Math.max(0, prevCount + (nextLiked ? 1 : -1))
    setComments((prev) =>
      prev.map((x) => (x.id === c.id ? { ...x, likeCount: nextCount, likedByViewer: nextLiked } : x))
    )
    const res = await toggleCommentLike(user.id, c.id, post.venue_review_id)
    if (!res.success) {
      setComments((prev) =>
        prev.map((x) => (x.id === c.id ? { ...x, likeCount: prevCount, likedByViewer: prevLiked } : x))
      )
    } else {
      setComments((prev) =>
        prev.map((x) =>
          x.id === c.id ? { ...x, likeCount: res.likeCount ?? x.likeCount, likedByViewer: res.liked } : x
        )
      )
    }
  }

  const startReply = (c) => {
    setReplyParentId(c.id)
    const un = (c.profile?.username || '').trim().toLowerCase()
    const prefix = un ? `@${un} ` : `@${displayName(c.profile)} `
    setCommentText(prefix)
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true })
    })
  }

  const openVenue = (venue) => {
    const root = navigation.getParent()?.getParent?.()
    root?.navigate?.('VenueProfile', { venueId: venue?.venue_id })
  }

  const openFriendProfile = (userId) => {
    if (!userId || !user?.id || userId === user.id) return
    const root = navigation.getParent()?.getParent?.()
    root?.navigate?.('FriendProfile', { userId })
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
  const postAuthorId = post.author?.id || post.user_id
  const authorRowTappable = !!(postAuthorId && user?.id && postAuthorId !== user.id)

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable style={styles.headerBtn} onPress={() => navigation.goBack()} hitSlop={12}>
          <ChevronLeft size={22} color={colors.textPrimary} strokeWidth={2} />
        </Pressable>
        <Text style={styles.headerTitle}>Review</Text>
        <View style={styles.headerBtnPlaceholder} />
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <View style={styles.scrollWrap}>
          <ScrollView
            ref={scrollRef}
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
        <View style={styles.topBlock}>
          <View style={styles.heroLeft}>
            <View style={styles.authorRow}>
              <Pressable
                style={({ pressed }) => [styles.headerMain, authorRowTappable && pressed && styles.headerMainPressed]}
                onPress={() => authorRowTappable && openFriendProfile(postAuthorId)}
                disabled={!authorRowTappable}
              >
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
              </Pressable>
              {post.rating10 != null ? (
                <View style={styles.ratingBadgeLg} accessibilityLabel={`Rating ${Number(post.rating10).toFixed(1)} out of 10`}>
                  <Text style={styles.ratingBadgeLgText}>{Number(post.rating10).toFixed(1)}</Text>
                </View>
              ) : null}
            </View>

            <Pressable
              style={styles.venueRow}
              onPress={() => openVenue(venue)}
              android_ripple={Platform.OS === 'android' ? androidRipple.light : undefined}
            >
              <View style={styles.venueInfo}>
                <Text style={styles.venueName}>{venue?.name || 'Venue'}</Text>
                {venue?.neighborhood_name ? (
                  <Text style={styles.venueNeighborhood}>{venue.neighborhood_name}</Text>
                ) : null}
              </View>
            </Pressable>
          </View>

          {post.review_text ? (
            <MentionText
              text={post.review_text}
              mentionProfiles={post.mentionProfiles || []}
              style={styles.reviewTextLg}
            />
          ) : null}

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
            {comments.map((c, idx) => {
              const cid = c.user_id || c.profile?.id
              const canOpen = !!(cid && user?.id && cid !== user.id)
              const isReply = !!c.parent_comment_id
              return (
                <View
                  key={c.id}
                  style={[
                    styles.commentRow,
                    isReply && styles.commentRowIndented,
                    idx === comments.length - 1 && styles.commentRowLast,
                  ]}
                >
                  <Pressable
                    style={styles.commentAvatarPress}
                    onPress={() => canOpen && openFriendProfile(cid)}
                    disabled={!canOpen}
                  >
                    <View style={styles.commentAvatar}>
                      {c.profile?.avatar_url ? (
                        <Image source={{ uri: c.profile.avatar_url }} style={styles.commentAvatarImg} />
                      ) : (
                        <Text style={styles.commentAvatarText}>{displayName(c.profile).slice(0, 2).toUpperCase()}</Text>
                      )}
                    </View>
                  </Pressable>
                  <View style={styles.commentMain}>
                    <View style={styles.commentMeta}>
                      <Text style={styles.commentName}>{displayName(c.profile)}</Text>
                      <Text style={styles.commentWhen}>{formatCommentTime(c.created_at)}</Text>
                    </View>
                    <View style={styles.commentBodyWrap}>
                      <MentionText
                        text={c.comment_text}
                        mentionProfiles={c.mentionProfiles || []}
                        style={styles.commentBody}
                      />
                    </View>
                    {user?.id ? (
                      <Pressable onPress={() => startReply(c)} hitSlop={8}>
                        <Text style={styles.commentReply}>Reply</Text>
                      </Pressable>
                    ) : null}
                  </View>
                  <Pressable
                    style={styles.commentLikeCol}
                    onPress={() => handleToggleCommentLike(c)}
                    disabled={!user?.id}
                    hitSlop={8}
                  >
                    <Heart
                      size={14}
                      color={c.likedByViewer ? '#ec003f' : colors.textSecondary}
                      fill={c.likedByViewer ? '#ec003f' : 'transparent'}
                      strokeWidth={2}
                    />
                    <Text style={styles.commentLikeCount}>{c.likeCount ?? 0}</Text>
                  </Pressable>
                </View>
              )
            })}
          </View>
        </View>
          </ScrollView>
        </View>

        {user?.id ? (
          <View style={[styles.commentsComposer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            {replyParentId != null ? (
              <View style={styles.replyHintRow}>
                <Text style={styles.replyHint}>Replying in thread — </Text>
                <Pressable onPress={() => setReplyParentId(null)} hitSlop={8}>
                  <Text style={styles.replyCancel}>Cancel</Text>
                </Pressable>
              </View>
            ) : null}
            {mentionOpen && user?.id && mentionResults.length > 0 ? (
              <ScrollView
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled
                style={styles.mentionListScroll}
              >
                {mentionResults.map((p) => (
                  <Pressable key={p.id} style={styles.mentionRow} onPress={() => pickCommentMention(p)}>
                    <Text style={styles.mentionName}>{displayNameForMention(p) || p.username || 'User'}</Text>
                    {p.username ? <Text style={styles.mentionHandle}>@{p.username}</Text> : null}
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}
            <View style={styles.composerRow}>
            <View style={styles.composerAvatar}>
              {myProfile?.avatar_url || user?.user_metadata?.avatar_url ? (
                <Image
                  source={{ uri: myProfile?.avatar_url || user.user_metadata.avatar_url }}
                  style={styles.composerAvatarImg}
                />
              ) : (
                <Text style={styles.composerAvatarText}>{composerInitials(user)}</Text>
              )}
            </View>
            <TextInput
              style={styles.composerInput}
              value={commentText}
              onChangeText={onCommentTextChange}
              placeholder="Add a comment..."
              placeholderTextColor={colors.textTag}
              onSubmitEditing={handleCommentSubmit}
              returnKeyType="send"
              blurOnSubmit={false}
            />
            <Pressable onPress={handleCommentSubmit} disabled={!commentText.trim()} hitSlop={8}>
              <Text style={[styles.composerPost, !commentText.trim() && styles.composerPostDisabled]}>Post</Text>
            </Pressable>
            </View>
          </View>
        ) : null}
      </KeyboardAvoidingView>
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
  /** Required — KAV without flex:1 collapses and ScrollView gets 0 height */
  keyboardAvoid: {
    flex: 1,
    width: '100%',
  },
  scrollWrap: {
    flex: 1,
    minHeight: 0,
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
  headerMainPressed: { opacity: 0.88 },
  avatarLg: {
    width: 48,
    height: 48,
    borderRadius: 24,
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
    fontSize: 11,
    fontFamily: fontFamilies.interBold,
    fontWeight: fontWeights.bold,
    letterSpacing: 0.85,
    textTransform: 'uppercase',
    color: colors.textPrimary,
  },
  time: {
    fontSize: 11,
    fontFamily: serifTime,
    fontStyle: 'italic',
    color: colors.textSecondary,
    marginTop: 4,
  },
  /* Match ReviewPostCard rating badge */
  ratingBadgeLg: {
    borderWidth: 1,
    borderColor: colors.browseAccentBorder,
    backgroundColor: colors.browseAccent,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  ratingBadgeLgText: {
    fontFamily: fontFamilies.fraunces,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textOnDark,
    letterSpacing: -0.3,
  },
  /* Same card as social feed ReviewPostCard venue row */
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
    fontSize: fontSizes.meta,
    fontFamily: fontFamilies.interBold,
    fontWeight: fontWeights.bold,
    letterSpacing: 0.75,
    textTransform: 'uppercase',
    color: colors.textSecondary,
    lineHeight: 14,
    marginTop: 2,
  },
  /* Aligned with feed review body (ReviewPostCard reviewText) */
  reviewTextLg: {
    fontSize: fontSizes.lg,
    fontFamily: serifBody,
    color: '#27272a',
    lineHeight: 28,
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
  commentRowIndented: {
    marginLeft: 8,
    paddingLeft: 10,
    borderLeftWidth: 2,
    borderLeftColor: colors.border,
  },
  commentRowLast: { marginBottom: 0 },
  commentAvatarPress: {},
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
    borderRadius: 16,
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
    fontSize: 11,
    fontFamily: fontFamilies.interBold,
    fontWeight: fontWeights.bold,
    letterSpacing: 0.85,
    textTransform: 'uppercase',
    color: colors.textPrimary,
  },
  commentWhen: {
    fontSize: 11,
    fontFamily: serifTime,
    fontStyle: 'italic',
    color: colors.textSecondary,
  },
  commentBody: {
    fontSize: 15,
    fontFamily: serifBody,
    lineHeight: 23,
    color: '#3f3f47',
    marginBottom: 8,
  },
  commentReply: {
    fontSize: 10,
    fontFamily: fontFamilies.interBold,
    fontWeight: fontWeights.bold,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.browseAccent,
    marginTop: 2,
  },
  commentLikeCol: { alignItems: 'center', gap: 4, paddingTop: 4, minWidth: 28 },
  commentLikeCount: {
    fontSize: 10,
    fontFamily: fontFamilies.interBold,
    fontWeight: fontWeights.bold,
    color: colors.textTag,
  },
  commentsComposer: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 8,
    flexShrink: 0,
    paddingHorizontal: spacing.xl,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.backgroundCanvas,
  },
  replyHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  replyHint: {
    fontSize: 12,
    color: colors.textMuted,
    fontFamily: fontFamilies.inter,
  },
  replyCancel: {
    fontSize: 12,
    color: colors.browseAccent,
    fontWeight: '600',
    fontFamily: fontFamilies.inter,
  },
  mentionListScroll: {
    maxHeight: 180,
    borderWidth: 1,
    borderColor: '#e4e4e7',
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  mentionRow: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f4f4f5',
  },
  mentionName: {
    fontSize: 14,
    fontFamily: fontFamilies.interSemiBold,
    color: '#18181b',
  },
  mentionHandle: {
    fontSize: 12,
    fontFamily: fontFamilies.inter,
    color: '#71717b',
    marginTop: 2,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  composerAvatar: {
    width: 32,
    height: 32,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
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
    fontSize: 15,
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
