/**
 * Figma NewCo — Friend Profile (106:1911): Back, identity, stats, Follow + Message, Top 5, Reviews | Lists.
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Image,
  ActivityIndicator,
} from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ChevronLeft, Lock } from 'lucide-react-native'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import {
  getFollowCounts,
  getFollowStatus,
  getTargetIsPrivate,
  canViewPrivateProfile,
  followOrRequest,
  unfollowUser,
  cancelFollowRequest,
} from '../services/follows'
import { getUserTopTenVenues, getUserTopTenEligibility } from '../services/userTopTen'
import { getPublicListsForUser } from '../utils/venueLists'
import { colors, fontSizes, fontWeights, spacing, fontFamilies } from '../theme'
import ProfilePhotoViewerModal from '../components/ProfilePhotoViewerModal'

const TABS = ['reviews', 'lists']

function deriveHandle(displayName) {
  if (!displayName || !displayName.trim()) return null
  const parts = displayName.trim().split(/\s+/)
  const first = (parts[0] || '').toLowerCase().replace(/[^a-z0-9]/g, '')
  const last = parts.length > 1 ? (parts[1] || '').charAt(0).toLowerCase() : ''
  return first && first + last ? `@${first}${last}` : null
}

function formatRelativeSentence(dateStr) {
  if (!dateStr) return 'recently'
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return 'recently'
  const now = new Date()
  const diffMs = now - d
  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000))
  if (days < 1) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`
  if (days < 365) return `${Math.floor(days / 30)} months ago`
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

export default function FriendProfileScreen() {
  const navigation = useNavigation()
  const route = useRoute()
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const userId = route.params?.userId

  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('reviews')
  const [myReviews, setMyReviews] = useState([])
  const [topTen, setTopTen] = useState([])
  const [topTenEligibility, setTopTenEligibility] = useState({
    has_unlocked_top_five: false,
    has_unlocked_top_ten: false,
  })
  const [followCounts, setFollowCounts] = useState({ followers: 0, following: 0 })
  const [publicLists, setPublicLists] = useState([])
  const [followStatus, setFollowStatus] = useState('none')
  const [targetIsPrivate, setTargetIsPrivate] = useState(false)
  const [profileLocked, setProfileLocked] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)
  const [reviewCount, setReviewCount] = useState(0)
  const [photoViewerVisible, setPhotoViewerVisible] = useState(false)
  const scrollRef = useRef(null)
  const [tabsLayoutY, setTabsLayoutY] = useState(0)

  const topFive = useMemo(() => topTen.slice(0, 5), [topTen])

  const load = useCallback(async () => {
    if (!userId || !user?.id) return
    setLoading(true)
    try {
      const [
        profileRes,
        reviewsRes,
        topTenRes,
        eligRes,
        countsRes,
        listsRes,
        privRes,
        canView,
        status,
        reviewCountRes,
      ] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase
          .from('venue_review')
          .select(
            `
          venue_review_id,
          rating10,
          review_text,
          review_date,
          created_at,
          venue_id,
          venue:venue_id (venue_id, name, neighborhood_name)
        `
          )
          .eq('user_id', userId)
          .order('review_date', { ascending: false })
          .limit(50),
        getUserTopTenVenues(userId),
        getUserTopTenEligibility(userId),
        getFollowCounts(userId),
        getPublicListsForUser(userId),
        getTargetIsPrivate(userId),
        canViewPrivateProfile(userId, user.id),
        getFollowStatus(user.id, userId),
        supabase
          .from('venue_review')
          .select('venue_review_id', { count: 'exact', head: true })
          .eq('user_id', userId),
      ])
      if (profileRes.data) setProfile(profileRes.data)
      if (reviewsRes.data) setMyReviews(reviewsRes.data)
      setTopTen(topTenRes || [])
      if (eligRes) setTopTenEligibility(eligRes)
      if (countsRes) setFollowCounts(countsRes)
      setPublicLists(listsRes?.data || [])
      setTargetIsPrivate(!!privRes)
      setFollowStatus(status || 'none')
      setProfileLocked(!!privRes && !canView)
      const rc = reviewCountRes?.count
      setReviewCount(typeof rc === 'number' ? rc : 0)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [userId, user?.id])

  useEffect(() => {
    if (user?.id && userId && userId === user.id) {
      navigation.replace('MainTabs', { screen: 'Profile' })
    }
  }, [user?.id, userId, navigation])

  useEffect(() => {
    if (userId && user?.id) load()
  }, [userId, user?.id, load])

  const displayName = profile?.first_name
    ? [profile.first_name, profile.last_name].filter(Boolean).join(' ')
    : 'User'
  const handle = deriveHandle(displayName)

  const goBack = () => {
    if (navigation.canGoBack()) navigation.goBack()
    else navigation.navigate('MainTabs', { screen: 'Social' })
  }

  const handleFollow = async () => {
    if (!user?.id || !userId || followLoading) return
    setFollowLoading(true)
    try {
      const st = followStatus || 'none'
      if (st === 'following') {
        const { success } = await unfollowUser(user.id, userId)
        if (success) {
          setFollowStatus('none')
          getFollowCounts(userId).then(setFollowCounts)
        }
      } else if (st === 'pending') {
        const { success } = await cancelFollowRequest(user.id, userId)
        if (success) setFollowStatus('none')
      } else {
        const { success, status: newStatus, error } = await followOrRequest(user.id, userId)
        if (success) {
          if (newStatus) {
            setFollowStatus(newStatus)
            getFollowCounts(userId).then(setFollowCounts)
            if (newStatus === 'following') {
              setProfileLocked(false)
              load()
            }
          }
        } else if (error) {
          console.warn('followOrRequest:', error)
        }
      }
    } finally {
      setFollowLoading(false)
    }
  }

  const followLabel =
    followLoading ? '...'
    : followStatus === 'following' ? 'Following'
    : followStatus === 'pending' ? 'Requested'
    : targetIsPrivate ? 'Request to Follow'
    : 'Follow'

  const handleMessage = () => {
    navigation.navigate('MainTabs', { screen: 'Chat' })
  }

  const handleVenuePress = (venue) => {
    navigation.getParent()?.navigate?.('VenueProfile', { venueId: venue?.venue_id })
  }

  const handleListPress = (list) => {
    navigation.navigate('MainTabs', {
      screen: 'Profile',
      params: { screen: 'ListDetail', params: { listId: list.list_id } },
    })
  }

  const openReviewedVenuesList = () => {
    if (!userId) return
    navigation.navigate('ReviewedVenuesList', { userId })
  }

  const openFollowers = () => {
    if (!userId) return
    navigation.navigate('FollowList', { userId, mode: 'followers' })
  }

  const openFollowing = () => {
    if (!userId) return
    navigation.navigate('FollowList', { userId, mode: 'following' })
  }

  const scrollToReviews = () => {
    setActiveTab('reviews')
    setTimeout(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, tabsLayoutY - 12), animated: true })
    }, 100)
  }

  const openSocialReview = (reviewId) => {
    navigation.navigate('SocialReviewDetail', { reviewId })
  }

  if (!userId) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Missing profile.</Text>
      </View>
    )
  }

  if (loading && !profile) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.profileAccent} />
      </View>
    )
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={goBack} accessibilityRole="button" accessibilityLabel="Back">
          <ChevronLeft size={22} color={colors.textPrimary} strokeWidth={2} />
          <Text style={styles.backText}>BACK</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {profileLocked ? (
          <>
            <View style={styles.hero}>
                <View style={styles.lockedHeroTop}>
                <Pressable
                  onPress={() => profile && setPhotoViewerVisible(true)}
                  disabled={!profile}
                  style={({ pressed }) => [styles.avatarWrap, pressed && profile && styles.avatarPressed]}
                  accessibilityRole="button"
                  accessibilityLabel="View profile photo"
                >
                  {profile?.avatar_url ? (
                    <Image source={{ uri: profile.avatar_url }} style={styles.avatar} resizeMode="cover" />
                  ) : (
                    <Text style={styles.avatarLetter}>{(displayName || '?')[0]}</Text>
                  )}
                </Pressable>
                <View style={styles.lockIconTopRight} accessibilityLabel="Private account">
                  <Lock size={22} color={colors.textSecondary} strokeWidth={2} />
                </View>
              </View>
              <Text style={styles.displayName}>{displayName}</Text>
              {handle ? <Text style={styles.handle}>{handle}</Text> : null}
              <View style={styles.stats}>
                <View style={[styles.statCell, styles.statCellDivider]}>
                  <Text style={styles.statValue}>{followCounts.followers}</Text>
                  <Text style={styles.statLabel}>Followers</Text>
                </View>
                <View style={[styles.statCell, styles.statCellDivider]}>
                  <Text style={styles.statValue}>{followCounts.following}</Text>
                  <Text style={styles.statLabel}>Following</Text>
                </View>
                <View style={styles.statCell}>
                  <Text style={styles.statValue}>{reviewCount}</Text>
                  <Text style={styles.statLabel}>Reviews</Text>
                </View>
              </View>
              {user?.id && user.id !== userId ? (
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={[
                      styles.followPrimary,
                      followStatus === 'following' && styles.followPrimaryActive,
                      followStatus === 'pending' && styles.followPending,
                    ]}
                    onPress={handleFollow}
                    disabled={followLoading}
                  >
                    <Text
                      style={[
                        styles.followPrimaryText,
                        followStatus === 'pending' && styles.followPrimaryTextDark,
                      ]}
                    >
                      {followLabel}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.messageBtn} onPress={handleMessage}>
                    <Text style={styles.messageBtnText}>Message</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
            <View style={styles.privateLockedBody}>
              <View style={styles.privateLockedIconWrap}>
                <Lock size={32} color={colors.textSecondary} strokeWidth={1.75} />
              </View>
              <Text style={styles.privateLockedTitle}>This account is private</Text>
              <Text style={styles.privateLockedCopy}>
                Follow this account to see their reviews and saved lists.
              </Text>
            </View>
          </>
        ) : (
          <>
            <View style={styles.hero}>
              <Pressable
                onPress={() => profile && setPhotoViewerVisible(true)}
                disabled={!profile}
                style={({ pressed }) => [styles.avatarWrap, pressed && profile && styles.avatarPressed]}
                accessibilityRole="button"
                accessibilityLabel="View profile photo"
              >
                {profile?.avatar_url ? (
                  <Image source={{ uri: profile.avatar_url }} style={styles.avatar} resizeMode="cover" />
                ) : (
                  <Text style={styles.avatarLetter}>{(displayName || '?')[0]}</Text>
                )}
              </Pressable>
              <Text style={styles.displayName}>{displayName}</Text>
              {handle ? <Text style={styles.handle}>{handle}</Text> : null}

              <View style={styles.stats}>
                <Pressable style={[styles.statCell, styles.statCellDivider]} onPress={openFollowers}>
                  <Text style={styles.statValue}>{followCounts.followers}</Text>
                  <Text style={styles.statLabel}>Followers</Text>
                </Pressable>
                <Pressable style={[styles.statCell, styles.statCellDivider]} onPress={openFollowing}>
                  <Text style={styles.statValue}>{followCounts.following}</Text>
                  <Text style={styles.statLabel}>Following</Text>
                </Pressable>
                <Pressable style={styles.statCell} onPress={scrollToReviews}>
                  <Text style={styles.statValue}>{myReviews.length}</Text>
                  <Text style={styles.statLabel}>Reviews</Text>
                </Pressable>
              </View>

              {user?.id && user.id !== userId ? (
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={[
                      styles.followPrimary,
                      followStatus === 'following' && styles.followPrimaryActive,
                      followStatus === 'pending' && styles.followPending,
                    ]}
                    onPress={handleFollow}
                    disabled={followLoading}
                  >
                    <Text
                      style={[
                        styles.followPrimaryText,
                        followStatus === 'pending' && styles.followPrimaryTextDark,
                      ]}
                    >
                      {followLabel}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.messageBtn} onPress={handleMessage}>
                    <Text style={styles.messageBtnText}>Message</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>

            <View style={styles.top5Section}>
              <View style={styles.top5Header}>
                <Text style={styles.top5Title}>Top 5</Text>
                {topTenEligibility.has_unlocked_top_five && topTen.length > 5 ? (
                  <Pressable onPress={openReviewedVenuesList} hitSlop={8}>
                    <Text style={styles.viewAll}>
                      View all <Text style={styles.viewAllChev}>›</Text>
                    </Text>
                  </Pressable>
                ) : null}
              </View>
              {!topTenEligibility.has_unlocked_top_five ? (
                <Text style={styles.muted}>Review more venues to unlock your Top 5</Text>
              ) : topFive.length === 0 ? (
                <Text style={styles.muted}>No venues yet.</Text>
              ) : (
                topFive.map((row) => (
                  <Pressable
                    key={row.venue_id}
                    style={styles.top5Row}
                    onPress={() => handleVenuePress({ venue_id: row.venue_id })}
                  >
                    <View style={styles.top5ThumbWrap}>
                      {row.primary_photo_url ? (
                        <Image source={{ uri: row.primary_photo_url }} style={styles.top5Thumb} />
                      ) : (
                        <View style={[styles.top5Thumb, styles.top5ThumbPh]} />
                      )}
                    </View>
                    <View style={styles.top5Text}>
                      <Text style={styles.top5VenueName} numberOfLines={1}>
                        {row.venue_name}
                      </Text>
                      {row.neighborhood_name ? (
                        <Text style={styles.top5Hood}>{String(row.neighborhood_name).toUpperCase()}</Text>
                      ) : null}
                    </View>
                    <Text style={styles.top5Score}>{row.user_score.toFixed(1)}</Text>
                  </Pressable>
                ))
              )}
            </View>

            <View style={styles.tabs} onLayout={(e) => setTabsLayoutY(e.nativeEvent.layout.y)}>
              {TABS.map((tab) => (
                <Pressable
                  key={tab}
                  style={[styles.tab, activeTab === tab && styles.tabActive]}
                  onPress={() => setActiveTab(tab)}
                >
                  <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab.toUpperCase()}</Text>
                </Pressable>
              ))}
            </View>

            {activeTab === 'reviews' && (
              <View style={styles.section}>
                {myReviews.length === 0 ? (
                  <Text style={styles.muted}>No reviews yet.</Text>
                ) : (
                  myReviews.map((r) => {
                    const venue = Array.isArray(r.venue) ? r.venue[0] : r.venue
                    const venueName = venue?.name || 'Venue'
                    const hood = venue?.neighborhood_name
                    const rel = formatRelativeSentence(r.review_date || r.created_at)
                    const hoodLabel = hood
                      ? String(hood).replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase())
                      : null
                    const meta = [hoodLabel, rel].filter(Boolean).join(' • ')
                    return (
                      <View key={r.venue_review_id} style={styles.reviewItem}>
                        <View style={styles.reviewHeaderRow}>
                          <Pressable style={styles.reviewTitleblock} onPress={() => handleVenuePress(venue)}>
                            <Text style={styles.reviewVenueName} numberOfLines={2}>
                              {venueName}
                            </Text>
                            {meta ? <Text style={styles.reviewMetaCaps}>{meta.toUpperCase()}</Text> : null}
                          </Pressable>
                          {r.rating10 != null ? (
                            <Text style={styles.reviewScoreBadge}>{Number(r.rating10).toFixed(1)}</Text>
                          ) : null}
                        </View>
                        <Pressable onPress={() => openSocialReview(r.venue_review_id)}>
                          <Text style={styles.reviewBody} numberOfLines={8}>
                            {r.review_text || '—'}
                          </Text>
                        </Pressable>
                      </View>
                    )
                  })
                )}
              </View>
            )}

            {activeTab === 'lists' && (
              <View style={styles.section}>
                {publicLists.length === 0 ? (
                  <Text style={styles.muted}>No public lists yet.</Text>
                ) : (
                  publicLists.map((list) => (
                    <Pressable key={list.list_id} style={styles.listRow} onPress={() => handleListPress(list)}>
                      <Text style={styles.listName} numberOfLines={1}>
                        {list.list_name}
                      </Text>
                      <Text style={styles.listMeta}>
                        {list.item_count} {list.item_count === 1 ? 'place' : 'places'}
                      </Text>
                    </Pressable>
                  ))
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>

      <ProfilePhotoViewerModal
        visible={photoViewerVisible}
        onClose={() => setPhotoViewerVisible(false)}
        avatarUrl={profile?.avatar_url}
        initialLetter={(displayName || '?')[0]}
        showEditActions={false}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.backgroundCanvas },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.backgroundCanvas },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: spacing['3xl'] },
  topBar: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: colors.border,
    backgroundColor: colors.backgroundCanvas,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backText: {
    fontSize: 12,
    fontFamily: fontFamilies.interBold,
    fontWeight: fontWeights.bold,
    letterSpacing: 1.2,
    color: colors.textPrimary,
  },
  hero: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    borderBottomWidth: 2,
    borderBottomColor: colors.border,
  },
  avatarWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: colors.border,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  avatarPressed: { opacity: 0.9 },
  avatar: { width: '100%', height: '100%' },
  avatarLetter: { fontSize: fontSizes['2xl'], fontFamily: fontFamilies.fraunces, color: colors.textMuted },
  displayName: {
    fontSize: fontSizes['4xl'],
    fontFamily: fontFamilies.fraunces,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  handle: {
    fontSize: fontSizes.sm,
    fontFamily: fontFamilies.frauncesItalic,
    fontStyle: 'italic',
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  stats: {
    flexDirection: 'row',
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderColor: colors.border,
    paddingVertical: 14,
    marginBottom: spacing.lg,
  },
  statCell: { flex: 1, alignItems: 'center' },
  statCellDivider: { borderRightWidth: 1, borderRightColor: colors.border },
  statValue: {
    fontSize: fontSizes['2xl'],
    fontFamily: fontFamilies.fraunces,
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: 10,
    fontFamily: fontFamilies.interBold,
    color: colors.textTag,
    letterSpacing: 1,
    marginTop: 4,
    textTransform: 'uppercase',
  },
  actionRow: { flexDirection: 'row', gap: 12 },
  followPrimary: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.profileAccent,
  },
  followPrimaryActive: {
    backgroundColor: colors.profileAccent,
  },
  followPending: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.browseAccent,
  },
  followPrimaryText: {
    fontSize: 12,
    fontFamily: fontFamilies.interBold,
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  followPrimaryTextDark: { color: colors.textPrimary },
  messageBtn: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#18181B',
  },
  messageBtnText: {
    fontSize: 12,
    fontFamily: fontFamilies.interBold,
    color: colors.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  top5Section: {
    backgroundColor: '#FDFBF7',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  top5Header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: spacing.md,
  },
  top5Title: {
    fontSize: fontSizes['2xl'],
    fontFamily: fontFamilies.fraunces,
    color: colors.textPrimary,
  },
  viewAll: {
    fontSize: 12,
    fontFamily: fontFamilies.interBold,
    fontWeight: fontWeights.bold,
    letterSpacing: 1.2,
    color: colors.textPrimary,
    textTransform: 'uppercase',
  },
  viewAllChev: { fontSize: 14 },
  top5Row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  top5ThumbWrap: {},
  top5Thumb: {
    width: 64,
    height: 64,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.border,
  },
  top5ThumbPh: { backgroundColor: colors.surface },
  top5Text: { flex: 1, minWidth: 0 },
  top5VenueName: {
    fontSize: fontSizes.lg,
    fontFamily: fontFamilies.fraunces,
    color: colors.textPrimary,
  },
  top5Hood: {
    fontSize: 10,
    fontFamily: fontFamilies.interBold,
    letterSpacing: 0.6,
    color: colors.textTag,
    marginTop: 2,
  },
  top5Score: {
    minWidth: 40,
    textAlign: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    fontSize: 11,
    fontFamily: fontFamilies.fraunces,
    fontWeight: fontWeights.bold,
    color: '#FFFFFF',
    backgroundColor: colors.profileAccent,
    borderWidth: 1,
    borderColor: colors.browseAccentBorder,
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#18181B',
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.base,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: '#18181B' },
  tabText: {
    fontSize: 10,
    fontFamily: fontFamilies.interBold,
    letterSpacing: 1,
    color: colors.textMuted,
  },
  tabTextActive: { color: colors.textPrimary },
  section: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg },
  reviewItem: {
    paddingVertical: spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  reviewHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  reviewTitleblock: { flex: 1, paddingRight: spacing.sm },
  reviewVenueName: {
    fontFamily: fontFamilies.fraunces,
    fontSize: 20,
    color: colors.textPrimary,
  },
  reviewMetaCaps: {
    fontSize: 10,
    fontFamily: fontFamilies.interBold,
    letterSpacing: 0.6,
    color: colors.textTag,
    marginTop: 6,
  },
  reviewScoreBadge: {
    fontSize: 11,
    fontFamily: fontFamilies.fraunces,
    fontWeight: fontWeights.bold,
    color: '#FFFFFF',
    backgroundColor: colors.profileAccent,
    borderWidth: 1,
    borderColor: colors.browseAccentBorder,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  reviewBody: {
    fontSize: fontSizes.sm,
    fontFamily: 'Georgia',
    color: '#3F3F47',
    lineHeight: 22,
  },
  listRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  listName: { fontSize: fontSizes.base, fontFamily: fontFamilies.fraunces, color: colors.textPrimary, flex: 1 },
  listMeta: { fontSize: fontSizes.sm, color: colors.textSecondary },
  muted: { fontSize: fontSizes.sm, color: colors.textMuted },
  lockedHeroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  lockIconTopRight: {
    paddingTop: 8,
    paddingRight: 0,
  },
  privateLockedBody: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing['2xl'],
    paddingBottom: spacing['3xl'],
    backgroundColor: colors.backgroundCanvas,
  },
  privateLockedIconWrap: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f4f4f5',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  privateLockedTitle: {
    fontFamily: fontFamilies.fraunces,
    fontSize: fontSizes['2xl'],
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  privateLockedCopy: {
    fontFamily: 'Georgia',
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
})
