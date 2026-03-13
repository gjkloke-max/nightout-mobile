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
import { getGroupedPreferences, getUserPreferenceIds, saveUserPreferences } from '../utils/preferences'
import VenueCard from '../components/VenueCard'
import { colors, fontSizes, fontWeights, spacing, borderRadius } from '../theme'

const TABS = ['Reviews', 'Lists', 'Saved', 'Preferences', 'Top 10']

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
      const [profileRes, favRes, listsRes, reviewsRes, topTenRes, eligRes, prefsRes] = await Promise.all([
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
      ])
      if (profileRes.data) setProfile(profileRes.data)
      if (favRes.data) setFavorites(favRes.data)
      if (listsRes.data) setLists(listsRes.data)
      if (reviewsRes.data) setMyReviews(reviewsRes.data)
      if (topTenRes) setTopTen(topTenRes)
      if (eligRes) setTopTenEligibility(eligRes)
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

  if (loading && !profile) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.avatarPlaceholder}>
          {profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
          ) : (
            <Text style={styles.avatarText}>{(displayName || '?')[0]}</Text>
          )}
        </View>
        <Text style={styles.displayName}>{displayName}</Text>
        {profile?.home_neighborhood_name ? (
          <Text style={styles.neighborhood}>{profile.home_neighborhood_name}</Text>
        ) : null}
      </View>

      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{myReviews.length}</Text>
          <Text style={styles.statLabel}>Reviews</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{lists.length}</Text>
          <Text style={styles.statLabel}>Lists</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{favorites.length}</Text>
          <Text style={styles.statLabel}>Saved</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.ctaButton} onPress={handleWriteReview} activeOpacity={0.8}>
        <Text style={styles.ctaText}>Write a Review</Text>
      </TouchableOpacity>

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
                  <Text style={styles.reviewRating}>{Number(r.rating10).toFixed(1)}</Text>
                  <Text style={styles.reviewText} numberOfLines={2}>{r.review_text || '—'}</Text>
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
        {activeTab === 'Preferences' && (
          <View style={styles.section}>
            {categories.map((cat) => (
              <View key={cat.preference_category_id} style={styles.prefCategory}>
                <Text style={styles.prefCategoryName}>{cat.name}</Text>
                <View style={styles.prefChips}>
                  {preferences
                    .filter((p) => p.preference_category_id === cat.preference_category_id)
                    .map((p) => (
                      <Pressable
                        key={p.preference_master_id}
                        style={[styles.prefChip, selectedPrefIds.has(p.preference_master_id) && styles.prefChipSelected]}
                        onPress={() => togglePreference(p.preference_master_id)}
                      >
                        <Text style={[styles.prefChipText, selectedPrefIds.has(p.preference_master_id) && styles.prefChipTextSelected]}>
                          {p.preference_name}
                        </Text>
                      </Pressable>
                    ))}
                </View>
              </View>
            ))}
            <Pressable style={[styles.savePrefsBtn, prefsSaving && styles.btnDisabled]} onPress={savePreferences} disabled={prefsSaving}>
              {prefsSaving ? <ActivityIndicator size="small" color={colors.textOnDark} /> : <Text style={styles.savePrefsText}>Save preferences</Text>}
            </Pressable>
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
  content: { padding: spacing.xl, paddingBottom: spacing['3xl'] },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { alignItems: 'center', marginBottom: spacing.lg },
  avatarPlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  avatar: { width: '100%', height: '100%' },
  avatarText: { fontSize: fontSizes['2xl'], color: colors.textMuted },
  displayName: {
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  neighborhood: { fontSize: fontSizes.sm, color: colors.textMuted },
  stats: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xl, marginBottom: spacing.xl },
  stat: { alignItems: 'center' },
  statValue: { fontSize: fontSizes.lg, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  statLabel: { fontSize: fontSizes.xs, color: colors.textMuted },
  ctaButton: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.base,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  ctaText: { fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.textOnDark },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  tab: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  tabActive: { backgroundColor: colors.accentMuted },
  tabText: { fontSize: fontSizes.sm, color: colors.textSecondary },
  tabTextActive: { color: colors.accent, fontWeight: fontWeights.semibold },
  tabContent: { marginBottom: spacing.xl },
  section: {},
  empty: { fontSize: fontSizes.sm, color: colors.textMuted, marginBottom: spacing.lg },
  reviewItem: { paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  reviewRating: { fontSize: fontSizes.sm, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.xs },
  reviewText: { fontSize: fontSizes.sm, color: colors.textSecondary },
  listItem: { paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  listName: { fontSize: fontSizes.base, fontWeight: '500', color: colors.textPrimary },
  listCount: { fontSize: fontSizes.sm, color: colors.textMuted },
  prefCategory: { marginBottom: spacing.lg },
  prefCategoryName: { fontSize: fontSizes.sm, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.sm },
  prefChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  prefChip: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  prefChipSelected: { backgroundColor: colors.accentMuted, borderColor: colors.accent },
  prefChipText: { fontSize: fontSizes.sm, color: colors.textPrimary },
  prefChipTextSelected: { color: colors.accent, fontWeight: '600' },
  savePrefsBtn: {
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    backgroundColor: colors.accent,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.7 },
  savePrefsText: { fontSize: fontSizes.base, color: colors.textOnDark, fontWeight: '600' },
  signOutBtn: { paddingVertical: spacing.base, alignItems: 'center' },
  signOutText: { fontSize: fontSizes.sm, color: colors.textMuted },
})
