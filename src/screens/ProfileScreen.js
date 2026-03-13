import { useState, useEffect } from 'react'
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
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { getUserFavorites } from '../utils/favorites'
import { getUserLists } from '../utils/venueLists'
import { getUserTopTenVenues, getUserTopTenEligibility } from '../services/userTopTen'
import { getFollowCounts } from '../services/follows'
import { getGroupedPreferences, getUserPreferenceIds, saveUserPreferences } from '../utils/preferences'
import VenueCard from '../components/VenueCard'
import { MapPin, Pencil, Plus } from 'lucide-react-native'
import { colors, fontSizes, fontWeights, fontFamilies, spacing, borderRadius, iconSizes } from '../theme'

const TABS = ['Reviews', 'Lists', 'Saved', 'Top 10']

function deriveHandle(displayName) {
  if (!displayName || !displayName.trim()) return null
  const parts = displayName.trim().split(/\s+/)
  const first = (parts[0] || '').toLowerCase().replace(/[^a-z0-9]/g, '')
  const last = parts.length > 1 ? (parts[1] || '').charAt(0).toLowerCase() : ''
  return first && (first + last) ? `@${first}${last}` : null
}

export default function ProfileScreen() {
  const navigation = useNavigation()
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
  const [categories, setCategories] = useState([])
  const [preferences, setPreferences] = useState([])
  const [selectedPrefIds, setSelectedPrefIds] = useState(new Set())
  const [prefsSaving, setPrefsSaving] = useState(false)

  useEffect(() => {
    if (user?.id) loadProfile()
  }, [user?.id])

  const loadProfile = async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const [profileRes, favRes, listsRes, reviewsRes, topTenRes, eligRes, prefsRes, countsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        getUserFavorites(),
        getUserLists(),
        supabase
          .from('venue_review')
          .select('venue_review_id, rating10, review_text, review_date, venue_id')
          .eq('user_id', user.id)
          .order('review_date', { ascending: false })
          .limit(50),
        getUserTopTenVenues(user.id),
        getUserTopTenEligibility(user.id),
        getGroupedPreferences(),
        getFollowCounts(user.id),
      ])
      if (profileRes.data) setProfile(profileRes.data)
      if (favRes.data) setFavorites(favRes.data)
      if (listsRes.data) setLists(listsRes.data)
      if (reviewsRes.data) setMyReviews(reviewsRes.data)
      if (topTenRes) setTopTen(topTenRes)
      if (eligRes) setTopTenEligibility(eligRes)
      if (countsRes) setFollowCounts(countsRes)
      if (prefsRes.categories) setCategories(prefsRes.categories)
      if (prefsRes.preferences) setPreferences(prefsRes.preferences)
      const ids = await getUserPreferenceIds(user.id)
      setSelectedPrefIds(new Set(ids))
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
    // TODO: Navigate to EditProfileScreen or open modal
  }

  const handleTopTenPress = () => {
    setActiveTab('Top 10')
  }

  const togglePreference = (id) => {
    setSelectedPrefIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const savePreferences = async () => {
    setPrefsSaving(true)
    await saveUserPreferences(user.id, [...selectedPrefIds])
    setPrefsSaving(false)
  }

  const handleListPress = (list) => {
    navigation.navigate('ListDetail', { listId: list.list_id })
  }

  const topTenPreviewImage = topTen[0]?.primary_photo_url || topTen[0]?.venue?.primary_photo_url

  if (loading && !profile) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile header - Figma design */}
      <View style={styles.profileHeader}>
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
        <Text style={styles.displayName}>{displayName}</Text>
        {handle ? <Text style={styles.handle}>{handle}</Text> : null}
        {profile?.home_neighborhood_name ? (
          <View style={styles.locationRow}>
            <MapPin size={iconSizes.inline} color={colors.textMuted} strokeWidth={2} style={styles.locationIcon} />
            <Text style={styles.neighborhood}>{profile.home_neighborhood_name}</Text>
          </View>
        ) : null}

        {/* Stats: Followers, Following, Reviews */}
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

        {/* Write a Review + Edit Profile */}
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

      {/* Top 10 Places section - Figma design */}
      <View style={styles.topTenSection}>
        <View style={styles.topTenHeader}>
          <Text style={styles.topTenTitle}>Top 10 Places</Text>
          {topTenEligibility.has_unlocked_top_ten && (
            <Pressable onPress={() => setActiveTab('Top 10')} hitSlop={8}>
              <Text style={styles.seeAllLink}>See All</Text>
            </Pressable>
          )}
        </View>
        <Pressable
          style={[styles.topTenCard, topTenPreviewImage && styles.topTenCardWithImage]}
          onPress={topTenEligibility.has_unlocked_top_ten ? handleTopTenPress : undefined}
        >
          {topTenPreviewImage ? (
            <Image source={{ uri: topTenPreviewImage }} style={styles.topTenCardImage} />
          ) : null}
          <View style={[styles.topTenCardOverlay, !topTenPreviewImage && styles.topTenCardOverlayLight]} />
          <View style={styles.topTenCardContent}>
            <Text style={styles.topTenStar}>⭐</Text>
            <Text style={[styles.topTenCardTitle, !topTenPreviewImage && styles.topTenCardTitleDark]}>Your Top 10</Text>
          </View>
          {!topTenEligibility.has_unlocked_top_ten && (
            <Text style={styles.topTenUnlockHint}>Review 10 places to unlock</Text>
          )}
        </Pressable>
      </View>

      {/* Tabs: Reviews, Lists, Saved */}
      <View style={styles.tabs}>
        {TABS.map((tab) => (
          <Pressable
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.tabContent}>
        {activeTab === 'Reviews' && (
          <View style={styles.section}>
            {myReviews.length === 0 ? (
              <Text style={styles.empty}>No reviews yet.</Text>
            ) : (
              myReviews.map((r) => (
                <View key={r.venue_review_id} style={styles.reviewItem}>
                  <View style={styles.reviewRatingBadge}>
                    <Text style={styles.reviewRating}>{Number(r.rating10).toFixed(1)}</Text>
                  </View>
                  <Text style={styles.reviewText} numberOfLines={3}>{r.review_text || '—'}</Text>
                </View>
              ))
            )}
          </View>
        )}
        {activeTab === 'Lists' && (
          <View style={styles.section}>
            {lists.length === 0 ? (
              <Text style={styles.empty}>No lists yet.</Text>
            ) : (
              lists.map((list) => (
                <Pressable key={list.list_id} style={styles.listItem} onPress={() => handleListPress(list)}>
                  <Text style={styles.listName}>{list.list_name}</Text>
                  <Text style={styles.listCount}>{list.item_count || 0} venues</Text>
                </Pressable>
              ))
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
        {activeTab === 'Top 10' && (
        <View style={styles.section}>
          {!topTenEligibility.has_unlocked_top_ten ? (
            <Text style={styles.empty}>
              Review 10+ venues to unlock your Top 10. You have {topTenEligibility.total_reviewed_count} reviews.
            </Text>
          ) : topTen.length === 0 ? (
            <Text style={styles.empty}>No Top 10 yet.</Text>
          ) : (
            topTen.map((item) => (
              <VenueCard key={item.venue_id} venue={item.venue} onPress={() => handleVenuePress(item.venue)} />
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing['3xl'] },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Profile header - Figma
  profileHeader: {
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(237,233,254,0.4)',
    padding: spacing.lg,
    marginHorizontal: -spacing.lg,
    marginTop: -spacing.lg,
    paddingTop: spacing.lg,
  },
  avatarRow: { flexDirection: 'row', marginBottom: spacing.sm },
  avatarWrapper: { position: 'relative' },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
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
    backgroundColor: '#7F22FE',
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
  },
  handle: { fontSize: fontSizes.sm, fontFamily: fontFamilies.interMedium, color: colors.textSecondary, marginBottom: spacing.xs },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.md },
  locationIcon: { marginRight: spacing.xs },
  neighborhood: { fontSize: fontSizes.sm, fontFamily: fontFamilies.interMedium, color: '#52525C' },
  stats: {
    flexDirection: 'row',
    gap: spacing.xl,
    marginBottom: spacing.lg,
  },
  stat: { alignItems: 'flex-start' },
  statValue: { fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colors.textPrimary },
  statLabel: { fontSize: fontSizes.xs, fontWeight: fontWeights.medium, color: colors.textSecondary, letterSpacing: 0.3 },
  actionRow: { flexDirection: 'row', gap: spacing.sm },
  writeReviewBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: '#18181B',
    paddingVertical: 12,
    borderRadius: 16,
  },
  writeReviewIcon: { marginRight: spacing.xs },
  writeReviewText: { fontSize: fontSizes.sm, fontFamily: fontFamilies.interMedium, color: '#FFFFFF' },
  editProfileBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(244,244,245,0.8)',
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    borderRadius: 16,
  },
  editProfileText: { fontSize: fontSizes.sm, fontFamily: fontFamilies.interMedium, color: colors.textPrimary },

  // Top 10 section
  topTenSection: { marginTop: spacing.lg, marginBottom: spacing.lg },
  topTenHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.base },
  topTenTitle: { fontSize: fontSizes.lg, fontFamily: fontFamilies.fraunces, color: colors.textPrimary },
  seeAllLink: { fontSize: fontSizes.sm, fontFamily: fontFamilies.interMedium, color: colors.textSecondary },
  topTenCard: {
    height: 128,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    position: 'relative',
  },
  topTenCardWithImage: { backgroundColor: 'transparent' },
  topTenCardImage: { position: 'absolute', width: '100%', height: '100%' },
  topTenCardOverlay: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(24,24,27,0.4)',
  },
  topTenCardOverlayLight: { backgroundColor: 'transparent' },
  topTenCardContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['2xl'],
  },
  topTenStar: { fontSize: 28, marginBottom: spacing.xs },
  topTenCardTitle: { fontSize: fontSizes.lg, fontFamily: fontFamilies.interBold, color: '#FFFFFF' },
  topTenCardTitleDark: { color: colors.textPrimary },
  topTenUnlockHint: {
    position: 'absolute',
    bottom: spacing.sm,
    alignSelf: 'center',
    fontSize: fontSizes.xs,
    fontFamily: fontFamilies.inter,
    color: colors.textSecondary,
  },

  // Tabs - Figma style
  tabs: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderBottomWidth: 1,
    borderBottomColor: '#000',
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
  tabText: { fontSize: fontSizes.sm, fontWeight: fontWeights.semibold, color: colors.textMuted },
  tabTextActive: { color: colors.textPrimary },

  tabContent: { marginBottom: spacing.xl },
  section: {},
  empty: { fontSize: fontSizes.sm, fontFamily: fontFamilies.inter, color: colors.textMuted, marginBottom: spacing.lg },
  reviewItem: {
    padding: spacing.base,
    marginBottom: spacing.base,
    backgroundColor: colors.backgroundElevated,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reviewRatingBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.success,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginBottom: spacing.xs,
  },
  reviewRating: { fontSize: 10, fontFamily: fontFamilies.interBold, color: '#FFFFFF' },
  reviewText: { fontSize: fontSizes.sm, fontFamily: fontFamilies.inter, color: colors.textPrimary },
  listItem: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  listName: { fontSize: fontSizes.base, fontFamily: fontFamilies.interMedium, color: colors.textPrimary },
  listCount: { fontSize: fontSizes.sm, fontFamily: fontFamilies.inter, color: colors.textMuted },
  signOutBtn: { paddingVertical: spacing.base, alignItems: 'center' },
  signOutText: { fontSize: fontSizes.sm, fontFamily: fontFamilies.inter, color: colors.textMuted },
})
