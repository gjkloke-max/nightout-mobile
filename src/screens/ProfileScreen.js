import { useState, useEffect, useMemo } from 'react'
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
import { useNavigation } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { getUserFavorites } from '../utils/favorites'
import { getUserLists } from '../utils/venueLists'
import { getUserTopTenVenues, getUserTopTenEligibility } from '../services/userTopTen'
import { getFollowCounts } from '../services/follows'
import VenueCard from '../components/VenueCard'
import { Pencil, Plus, Settings } from 'lucide-react-native'
import { colors, fontSizes, fontWeights, fontFamilies, spacing, iconSizes } from '../theme'

const TABS = ['Reviews', 'Lists', 'Saved']

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

export default function ProfileScreen() {
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const { user, signOut } = useAuth()
  const [profile, setProfile] = useState(null)
  const [activeTab, setActiveTab] = useState('Reviews')
  const [loading, setLoading] = useState(true)
  const [favorites, setFavorites] = useState([])
  const [lists, setLists] = useState([])
  const [myReviews, setMyReviews] = useState([])
  const [topTen, setTopTen] = useState([])
  const [topTenEligibility, setTopTenEligibility] = useState({ total_reviewed_count: 0, has_unlocked_top_ten: false })
  const [followCounts, setFollowCounts] = useState({ followers: 0, following: 0 })
  const topFive = useMemo(() => topTen.slice(0, 5), [topTen])

  useEffect(() => {
    if (user?.id) loadProfile()
  }, [user?.id])

  const loadProfile = async () => {
    if (!user?.id) return
    setLoading(true)
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
      setLoading(false)
    }
  }

  const displayName = profile?.first_name
    ? [profile.first_name, profile.last_name].filter(Boolean).join(' ')
    : user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'

  const handle = deriveHandle(displayName)

  const handleSignOut = async () => {
    await signOut()
  }

  const handleVenuePress = (venue) => {
    const root = navigation.getParent()?.getParent?.()
    root?.navigate?.('VenueProfile', { venueId: venue?.venue_id })
  }

  const handleWriteReview = () => {
    navigation.getParent()?.navigate?.('Browse')
  }

  const handleEditProfile = () => {
    // TODO: Navigate to EditProfileScreen when it exists
  }

  const handleListPress = (list) => {
    navigation.navigate('ListDetail', { listId: list.list_id })
  }

  if (loading && !profile) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.profileAccent} />
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: Math.max(spacing.lg, insets.top) }]}
    >
      <View style={styles.profileHeader}>
        <View style={styles.identityRow}>
          <View style={styles.avatarRow}>
            <View style={styles.avatarWrapper}>
              <View style={styles.avatarPlaceholder}>
                {profile?.avatar_url ? (
                  <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
                ) : (
                  <Text style={styles.avatarText}>{(displayName || '?')[0]}</Text>
                )}
              </View>
              <View style={styles.avatarAddBadge}>
                <Plus size={14} color="#FFFFFF" strokeWidth={2.5} />
              </View>
            </View>
          </View>
          <View style={styles.nameColumn}>
            <Text style={styles.displayName}>{displayName}</Text>
            {handle ? <Text style={styles.handle}>{handle}</Text> : null}
          </View>
          <TouchableOpacity
            style={styles.gearBtn}
            onPress={handleEditProfile}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Account settings"
          >
            <Settings size={22} color={colors.textPrimary} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{followCounts.followers}</Text>
            <Text style={styles.statLabel}>FOLLOWERS</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{followCounts.following}</Text>
            <Text style={styles.statLabel}>FOLLOWING</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{myReviews.length}</Text>
            <Text style={styles.statLabel}>REVIEWS</Text>
          </View>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.writeReviewBtn} onPress={handleWriteReview} activeOpacity={0.8}>
            <Pencil size={iconSizes.inline} color="#FFFFFF" strokeWidth={2} style={styles.writeReviewIcon} />
            <Text style={styles.writeReviewText}>Write a Review</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.editProfileBtn} onPress={handleEditProfile} activeOpacity={0.8}>
            <Text style={styles.editProfileText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* The Top 5 — matches web / Figma */}
      <View style={styles.top5Section}>
        <View style={styles.top5Header}>
          <Text style={styles.top5Title}>The Top 5</Text>
        </View>
        {!topTenEligibility.has_unlocked_top_ten ? (
          <View style={styles.top5Locked}>
            <Text style={styles.top5LockedText}>Review 10 places to unlock your ranked favorites.</Text>
            <Pressable onPress={handleWriteReview}>
              <Text style={styles.top5LockedCta}>Browse venues</Text>
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
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab.toUpperCase()}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.tabContent}>
        {activeTab === 'Reviews' && (
          <View style={styles.section}>
            {myReviews.length === 0 ? (
              <Text style={styles.empty}>No reviews yet.</Text>
            ) : (
              myReviews.map((r) => {
                const venue = Array.isArray(r.venue) ? r.venue[0] : r.venue
                const venueName = venue?.name || 'Venue'
                const hood = venue?.neighborhood_name
                const rel = formatRelativeCaps(r.review_date || r.created_at)
                const meta = [hood ? String(hood).toUpperCase() : null, rel].filter(Boolean).join(' • ')
                return (
                  <View key={r.venue_review_id} style={styles.reviewItem}>
                    <View style={styles.reviewTop}>
                      <Text style={styles.reviewVenueName} numberOfLines={2}>
                        {venueName}
                      </Text>
                      {r.rating10 != null && (
                        <Text style={styles.reviewScoreBadge}>{Number(r.rating10).toFixed(1)}</Text>
                      )}
                    </View>
                    {meta ? <Text style={styles.reviewMetaCaps}>{meta}</Text> : null}
                    <Text style={styles.reviewBody} numberOfLines={6}>
                      {r.review_text || '—'}
                    </Text>
                  </View>
                )
              })
            )}
          </View>
        )}
        {activeTab === 'Lists' && (
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
        {activeTab === 'Saved' && (
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

      <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.8}>
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const P = colors.profileAccent

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
    marginTop: -spacing.lg,
    paddingTop: spacing.lg,
    alignItems: 'stretch',
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  nameColumn: { flex: 1, minWidth: 0, justifyContent: 'center' },
  gearBtn: { padding: spacing.xs, marginTop: 2 },
  avatarRow: { flexDirection: 'row', justifyContent: 'flex-start' },
  avatarWrapper: { position: 'relative' },
  avatarPlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 8,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(228,228,231,0.5)',
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
    backgroundColor: P,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  displayName: {
    fontSize: fontSizes['2xl'],
    fontFamily: fontFamilies.fraunces,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
    textAlign: 'left',
  },
  handle: {
    fontSize: fontSizes.sm,
    fontFamily: fontFamilies.interMedium,
    color: colors.textSecondary,
    marginBottom: 0,
    textAlign: 'left',
  },
  stats: {
    flexDirection: 'row',
    gap: spacing.xl,
    marginBottom: spacing.lg,
    justifyContent: 'flex-start',
  },
  stat: { alignItems: 'center' },
  statValue: { fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colors.textPrimary },
  statLabel: { fontSize: fontSizes.xs, fontWeight: fontWeights.medium, color: colors.textSecondary, letterSpacing: 0.3 },
  actionRow: { flexDirection: 'row', gap: spacing.sm, width: '100%' },
  writeReviewBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: P,
    paddingVertical: 12,
    borderRadius: 16,
  },
  writeReviewIcon: { marginRight: spacing.xs },
  writeReviewText: { fontSize: fontSizes.sm, fontFamily: fontFamilies.interMedium, color: '#FFFFFF' },
  editProfileBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#18181B',
    paddingVertical: 12,
    borderRadius: 16,
  },
  editProfileText: { fontSize: fontSizes.sm, fontFamily: fontFamilies.interMedium, color: colors.textPrimary },

  top5Section: {
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
    backgroundColor: colors.backgroundElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.base,
  },
  top5Header: { marginBottom: spacing.sm },
  top5Title: { fontSize: fontSizes.lg, fontFamily: fontFamilies.fraunces, fontWeight: fontWeights.bold, color: colors.textPrimary },
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
  top5Thumb: { width: 48, height: 48, borderRadius: 4 },
  top5ThumbPlaceholder: { backgroundColor: colors.surface },
  top5Text: { flex: 1, minWidth: 0 },
  top5VenueName: { fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  top5Hood: { fontSize: 10, fontWeight: fontWeights.semibold, letterSpacing: 0.6, color: colors.textSecondary, marginTop: 2 },
  top5Score: {
    minWidth: 40,
    textAlign: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    overflow: 'hidden',
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
    color: '#FFFFFF',
    backgroundColor: P,
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
  tabText: { fontSize: 10, fontWeight: fontWeights.semibold, letterSpacing: 0.6, color: colors.textMuted },
  tabTextActive: { color: colors.textPrimary },

  tabContent: { marginBottom: spacing.xl },
  section: {},
  empty: { fontSize: fontSizes.sm, fontFamily: fontFamilies.inter, color: colors.textMuted, marginBottom: spacing.lg },
  reviewItem: {
    paddingVertical: spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  reviewTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm },
  reviewVenueName: {
    flex: 1,
    fontFamily: fontFamilies.fraunces,
    fontSize: fontSizes.base,
    fontWeight: fontWeights.semibold,
    color: colors.textPrimary,
  },
  reviewScoreBadge: {
    fontSize: 11,
    fontWeight: fontWeights.bold,
    color: '#FFFFFF',
    backgroundColor: P,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    overflow: 'hidden',
  },
  reviewMetaCaps: {
    fontSize: 10,
    fontWeight: fontWeights.semibold,
    letterSpacing: 0.5,
    color: '#888888',
    marginTop: 4,
    marginBottom: 6,
  },
  reviewBody: { fontSize: fontSizes.sm, fontFamily: fontFamilies.inter, color: colors.textPrimary, lineHeight: 20 },
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
    fontWeight: fontWeights.semibold,
    letterSpacing: 0.5,
    color: colors.textMuted,
    marginTop: 2,
  },
  signOutBtn: { paddingVertical: spacing.base, alignItems: 'center' },
  signOutText: { fontSize: fontSizes.sm, fontFamily: fontFamilies.inter, color: colors.textMuted },
})
