import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
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
import { useNavigation, useFocusEffect } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { getUserFavorites } from '../utils/favorites'
import { getUserLists } from '../utils/venueLists'
import { getUserTopTenVenues, getUserTopTenEligibility } from '../services/userTopTen'
import { getFollowCounts } from '../services/follows'
import VenueCard from '../components/VenueCard'
import { Plus, Settings } from 'lucide-react-native'
import { colors, fontSizes, fontWeights, fontFamilies, spacing } from '../theme'

const TABS = ['reviews', 'lists', 'saved']

function deriveHandle(displayName) {
  if (!displayName || !displayName.trim()) return null
  const parts = displayName.trim().split(/\s+/)
  const first = (parts[0] || '').toLowerCase().replace(/[^a-z0-9]/g, '')
  const last = parts.length > 1 ? (parts[1] || '').charAt(0).toLowerCase() : ''
  return first && first + last ? `@${first}${last}` : null
}

function formatRelativeCaps(dateStr) {
  if (!dateStr) return 'RECENTLY'
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return 'RECENTLY'
  const now = new Date()
  const diffMs = now - d
  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000))
  if (days < 1) return 'TODAY'
  if (days === 1) return 'YESTERDAY'
  if (days < 7) return `${days} DAYS AGO`
  if (days < 30) return `${Math.floor(days / 7)} WEEKS AGO`
  if (days < 365) return `${Math.floor(days / 30)} MO AGO`
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase()
}

/** Figma 63:629 — "Lakeview • 3 weeks ago" */
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

export default function ProfileScreen() {
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [activeTab, setActiveTab] = useState('reviews')
  const [loading, setLoading] = useState(true)
  const [favorites, setFavorites] = useState([])
  const [lists, setLists] = useState([])
  const [myReviews, setMyReviews] = useState([])
  const [topTen, setTopTen] = useState([])
  const [topTenEligibility, setTopTenEligibility] = useState({ total_reviewed_count: 0, has_unlocked_top_ten: false })
  const [followCounts, setFollowCounts] = useState({ followers: 0, following: 0 })
  const topFive = useMemo(() => topTen.slice(0, 5), [topTen])
  const profileRef = useRef(null)
  profileRef.current = profile

  const loadProfile = useCallback(async () => {
    if (!user?.id) return
    const showSpinner = !profileRef.current
    if (showSpinner) setLoading(true)
    try {
      const [profileRes, favRes, listsRes, reviewsRes, topTenRes, eligRes, countsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        getUserFavorites(),
        getUserLists(),
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
          .eq('user_id', user.id)
          .order('review_date', { ascending: false })
          .limit(50),
        getUserTopTenVenues(user.id),
        getUserTopTenEligibility(user.id),
        getFollowCounts(user.id),
      ])
      if (profileRes.data) setProfile(profileRes.data)
      if (favRes.data) setFavorites(favRes.data)
      if (listsRes.data) setLists(listsRes.data)
      if (reviewsRes.data) setMyReviews(reviewsRes.data)
      if (topTenRes) setTopTen(topTenRes)
      if (eligRes) setTopTenEligibility(eligRes)
      if (countsRes) setFollowCounts(countsRes)
    } catch (e) {
      console.error(e)
    } finally {
      if (showSpinner) setLoading(false)
    }
  }, [user?.id])

  useFocusEffect(
    useCallback(() => {
      if (user?.id) loadProfile()
    }, [user?.id, loadProfile])
  )

  const displayName = profile?.first_name
    ? [profile.first_name, profile.last_name].filter(Boolean).join(' ')
    : user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'

  const handle = deriveHandle(displayName)

  const handleVenuePress = (venue) => {
    const root = navigation.getParent()?.getParent?.()
    root?.navigate?.('VenueProfile', { venueId: venue?.venue_id })
  }

  const handleWriteReview = () => {
    const root = navigation.getParent()?.getParent()
    root?.navigate('WriteReview')
  }

  const handleEditProfile = () => {
    navigation.navigate('EditProfile')
  }

  const handleOpenSettings = () => {
    navigation.navigate('Settings')
  }

  const handleListPress = (list) => {
    navigation.navigate('ListDetail', { listId: list.list_id })
  }

  if (loading && !profile) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.browseAccent} />
      </View>
    )
  }

  return (
    <>
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingTop: Math.max(spacing.lg, insets.top) + spacing.md },
      ]}
    >
      <View style={styles.profileHeader}>
        <View style={styles.identityTopRow}>
          <View style={styles.avatarRow}>
            <View style={styles.avatarWrapper}>
              <View style={styles.avatarPlaceholder}>
                {profile?.avatar_url ? (
                  <Image source={{ uri: profile.avatar_url }} style={styles.avatar} resizeMode="cover" />
                ) : (
                  <Text style={styles.avatarText}>{(displayName || '?')[0]}</Text>
                )}
              </View>
              <View style={styles.avatarAddBadge}>
                <Plus size={14} color="#FFFFFF" strokeWidth={2.5} />
              </View>
            </View>
          </View>
          <TouchableOpacity
            style={styles.gearBtn}
            onPress={handleOpenSettings}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Settings"
          >
            <Settings size={22} color={colors.textPrimary} strokeWidth={2} />
          </TouchableOpacity>
        </View>
        <View style={styles.nameColumn}>
          <Text style={styles.displayName}>{displayName}</Text>
          {handle ? <Text style={styles.handle}>{handle}</Text> : null}
        </View>

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
            <Text style={styles.statValue}>{myReviews.length}</Text>
            <Text style={styles.statLabel}>Reviews</Text>
          </View>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.writeReviewBtn} onPress={handleWriteReview} activeOpacity={0.8}>
            <Text style={styles.writeReviewText}>Write review</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.editProfileBtn} onPress={handleEditProfile} activeOpacity={0.8}>
            <Text style={styles.editProfileText}>Edit profile</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Figma AppLayout 63:565 — Top 5 */}
      <View style={styles.top5Section}>
        <View style={styles.top5Header}>
          <Text style={styles.top5Title}>Top 5</Text>
        </View>
        {!topTenEligibility.has_unlocked_top_ten ? (
          <View style={styles.top5Locked}>
            <Text style={styles.top5LockedText}>Review 10 places to unlock your ranked favorites.</Text>
            <Pressable onPress={handleWriteReview}>
              <Text style={styles.top5LockedCta}>Write a review</Text>
            </Pressable>
          </View>
        ) : topFive.length === 0 ? (
          <Text style={styles.empty}>No venues yet.</Text>
        ) : (
          <View style={styles.top5List}>
            {topFive.map((row) => (
              <Pressable
                key={row.venue_id}
                style={styles.top5Row}
                onPress={() => handleVenuePress({ venue_id: row.venue_id })}
              >
                <View style={styles.top5ThumbWrap}>
                  {row.primary_photo_url ? (
                    <Image source={{ uri: row.primary_photo_url }} style={styles.top5Thumb} />
                  ) : (
                    <View style={[styles.top5Thumb, styles.top5ThumbPlaceholder]} />
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
            ))}
          </View>
        )}
      </View>

      <View style={styles.tabs}>
        {TABS.map((tab) => (
          <Pressable
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab.toUpperCase()}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.tabContent}>
        {activeTab === 'reviews' && (
          <View style={styles.section}>
            {myReviews.length === 0 ? (
              <Text style={styles.empty}>No reviews yet.</Text>
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
                      <View style={styles.reviewTitleblock}>
                        <Text style={styles.reviewVenueName} numberOfLines={2}>
                          {venueName}
                        </Text>
                        {meta ? <Text style={styles.reviewMetaCaps}>{meta}</Text> : null}
                      </View>
                      {r.rating10 != null && (
                        <Text style={styles.reviewScoreBadge}>{Number(r.rating10).toFixed(1)}</Text>
                      )}
                    </View>
                    <Text style={styles.reviewBody} numberOfLines={6}>
                      {r.review_text || '—'}
                    </Text>
                  </View>
                )
              })
            )}
          </View>
        )}
        {activeTab === 'lists' && (
          <View style={styles.section}>
            {lists.length === 0 ? (
              <Text style={styles.empty}>No lists yet.</Text>
            ) : (
              lists.map((list) => {
                const pv = list.preview_venues?.[0]
                const thumb = pv?.primary_photo_url
                const n = list.item_count ?? 0
                return (
                  <Pressable key={list.list_id} style={styles.listRow} onPress={() => handleListPress(list)}>
                    <View style={styles.listThumbWrap}>
                      {thumb ? (
                        <Image source={{ uri: thumb }} style={styles.listThumb} />
                      ) : (
                        <View style={[styles.listThumb, styles.listThumbPh]} />
                      )}
                    </View>
                    <View style={styles.listRowBody}>
                      <Text style={styles.listName} numberOfLines={1}>
                        {list.list_name}
                      </Text>
                      <Text style={styles.listMeta}>
                        {`${n} ${n === 1 ? 'PLACE' : 'PLACES'}`}
                        {list.updated_at ? ` · ${formatRelativeCaps(list.updated_at)}` : ''}
                      </Text>
                    </View>
                  </Pressable>
                )
              })
            )}
          </View>
        )}
        {activeTab === 'saved' && (
          <View style={styles.section}>
            {favorites.length === 0 ? (
              <Text style={styles.empty}>No saved venues.</Text>
            ) : (
              favorites.map((f) => (
                <VenueCard key={f.venue_id} venue={f.venue} onPress={() => handleVenuePress(f.venue)} />
              ))
            )}
          </View>
        )}
      </View>
    </ScrollView>
    </>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing['3xl'] },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  profileHeader: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(228,228,231,0.5)',
    padding: spacing.lg,
    marginHorizontal: -spacing.lg,
    paddingTop: spacing.lg,
    alignItems: 'stretch',
  },
  identityTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: spacing.md,
  },
  nameColumn: { width: '100%', marginBottom: spacing.md },
  gearBtn: { padding: spacing.xs, marginTop: 8 },
  avatarRow: { flexDirection: 'row', justifyContent: 'flex-start' },
  avatarWrapper: { position: 'relative' },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 8,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.border,
  },
  avatar: { width: '100%', height: '100%' },
  avatarText: { fontSize: fontSizes['2xl'], color: colors.textMuted, fontFamily: fontFamilies.fraunces },
  avatarAddBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.profileAccent,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  displayName: {
    fontSize: fontSizes['4xl'],
    fontFamily: fontFamilies.fraunces,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
    textAlign: 'left',
  },
  handle: {
    fontSize: fontSizes.sm,
    fontFamily: fontFamilies.frauncesItalic,
    fontStyle: 'italic',
    color: colors.textSecondary,
    marginBottom: 0,
    textAlign: 'left',
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
  statCellDivider: {
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
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
  actionRow: { flexDirection: 'row', gap: spacing.sm, width: '100%' },
  writeReviewBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.profileAccent,
    paddingVertical: 12,
    borderRadius: 0,
  },
  writeReviewText: {
    fontSize: 12,
    fontFamily: fontFamilies.interBold,
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  editProfileBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#18181B',
    paddingVertical: 12,
    borderRadius: 0,
  },
  editProfileText: {
    fontSize: 12,
    fontFamily: fontFamilies.interBold,
    color: colors.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },

  top5Section: {
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
    backgroundColor: '#FDFBF7',
    borderRadius: 0,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.xl,
    marginHorizontal: -spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  top5Header: { marginBottom: spacing.sm },
  top5Title: {
    fontSize: fontSizes['2xl'],
    fontFamily: fontFamilies.fraunces,
    fontWeight: fontWeights.normal,
    color: colors.textPrimary,
  },
  top5Locked: { paddingVertical: spacing.md, alignItems: 'center' },
  top5LockedText: { fontSize: fontSizes.sm, color: colors.textSecondary, textAlign: 'center', marginBottom: 0 },
  top5List: {},
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
  top5ThumbPlaceholder: { backgroundColor: colors.surface },
  top5Text: { flex: 1, minWidth: 0 },
  top5VenueName: {
    fontSize: fontSizes.lg,
    fontFamily: fontFamilies.fraunces,
    fontWeight: fontWeights.normal,
    color: colors.textPrimary,
  },
  top5Hood: {
    fontSize: 10,
    fontWeight: fontWeights.bold,
    fontFamily: fontFamilies.interBold,
    letterSpacing: 0.6,
    color: colors.textTag,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  top5Score: {
    minWidth: 40,
    textAlign: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 2,
    overflow: 'hidden',
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
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderBottomWidth: 1,
    borderBottomColor: '#18181B',
    marginHorizontal: -spacing.lg,
    marginBottom: spacing.lg,
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
    fontWeight: fontWeights.bold,
    letterSpacing: 1,
    color: colors.textMuted,
  },
  tabTextActive: { color: colors.textPrimary },

  tabContent: { marginBottom: spacing.xl },
  section: {},
  empty: { fontSize: fontSizes.sm, fontFamily: fontFamilies.inter, color: colors.textMuted, marginBottom: spacing.lg },
  reviewItem: {
    paddingVertical: spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  reviewHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  reviewTitleblock: {
    flex: 1,
    paddingRight: spacing.sm,
    flexDirection: 'column',
    gap: 6,
  },
  reviewVenueName: {
    fontFamily: fontFamilies.fraunces,
    fontSize: 20,
    fontWeight: fontWeights.normal,
    color: colors.textPrimary,
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
    borderRadius: 2,
    overflow: 'hidden',
  },
  reviewMetaCaps: {
    fontSize: 10,
    fontWeight: fontWeights.bold,
    fontFamily: fontFamilies.interBold,
    letterSpacing: 0.6,
    color: colors.textTag,
    marginTop: 0,
  },
  reviewBody: {
    fontSize: fontSizes.sm,
    fontFamily: 'Georgia',
    color: '#3F3F47',
    lineHeight: 22,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  listThumbWrap: { width: 48, height: 48, borderRadius: 6, overflow: 'hidden' },
  listThumb: { width: '100%', height: '100%' },
  listThumbPh: { backgroundColor: colors.surface },
  listRowBody: { flex: 1, minWidth: 0 },
  listName: { fontSize: fontSizes.base, fontFamily: fontFamilies.interMedium, color: colors.textPrimary },
  listMeta: {
    fontSize: 10,
    fontWeight: fontWeights.bold,
    fontFamily: fontFamilies.interBold,
    letterSpacing: 0.5,
    color: colors.textTag,
    marginTop: 2,
    textTransform: 'uppercase',
  },
})
