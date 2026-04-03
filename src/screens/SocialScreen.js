import { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  RefreshControl,
  TouchableOpacity,
  Pressable,
  Image,
  ActivityIndicator,
  Keyboard,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '../contexts/AuthContext'
import { getSocialFeed } from '../services/socialFeed'
import { searchUsers } from '../services/userSearch'
import {
  followOrRequest,
  unfollowUser,
  cancelFollowRequest,
  getFollowStatusBatch,
} from '../services/follows'
import { useDebounce } from '../hooks/useDebounce'
import ReviewPostCard from '../components/ReviewPostCard'
import NotificationsBellButton from '../components/NotificationsBellButton'
import { Search } from 'lucide-react-native'
import { colors, fontSizes, fontWeights, spacing, borderRadius, iconSizes } from '../theme'

function displayName(p) {
  if (!p) return 'Anonymous'
  const parts = [p.first_name, p.last_name].filter(Boolean)
  return parts.length ? parts.join(' ') : 'Anonymous'
}

export default function SocialScreen() {
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const [feed, setFeed] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [followStatusMap, setFollowStatusMap] = useState(new Map())
  const [followLoading, setFollowLoading] = useState(null)

  const debouncedQuery = useDebounce(searchQuery, 300)

  const loadFeed = useCallback(async () => {
    if (!user?.id) return
    const data = await getSocialFeed(user.id)
    setFeed(data)
  }, [user?.id])

  useEffect(() => {
    loadFeed().finally(() => setLoading(false))
  }, [loadFeed])

  const onRefresh = async () => {
    setRefreshing(true)
    await loadFeed()
    setRefreshing(false)
  }

  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) {
      setSearchResults([])
      setFollowStatusMap(new Map())
      return
    }
    let cancelled = false
    setSearchLoading(true)
    searchUsers(user?.id, debouncedQuery)
      .then((data) => {
        if (!cancelled) setSearchResults(data || [])
      })
      .finally(() => {
        if (!cancelled) setSearchLoading(false)
      })
    return () => { cancelled = true }
  }, [debouncedQuery, user?.id])

  useEffect(() => {
    if (!user?.id || searchResults.length === 0) return
    getFollowStatusBatch(user.id, searchResults.map((u) => u.id)).then(setFollowStatusMap)
  }, [user?.id, searchResults])

  const handleFollow = async (targetId) => {
    if (!user?.id || targetId === user.id || followLoading) return
    setFollowLoading(targetId)
    try {
      const status = followStatusMap.get(targetId) || 'none'
      if (status === 'following') {
        const { success } = await unfollowUser(user.id, targetId)
        if (success) {
          setFollowStatusMap((m) => new Map(m).set(targetId, 'none'))
        }
      } else if (status === 'pending') {
        const { success } = await cancelFollowRequest(user.id, targetId)
        if (success) {
          setFollowStatusMap((m) => new Map(m).set(targetId, 'none'))
        }
      } else {
        const { success, status: newStatus } = await followOrRequest(user.id, targetId)
        if (success && newStatus) {
          setFollowStatusMap((m) => new Map(m).set(targetId, newStatus))
          loadFeed()
        }
      }
    } finally {
      setFollowLoading(null)
    }
  }

  const handleVenuePress = (venue) => {
    const root = navigation.getParent()?.getParent?.()
    root?.navigate?.('VenueProfile', { venueId: venue?.venue_id })
  }

  const handleLikeChange = () => {
    loadFeed()
  }

  const isSearching = searchQuery.trim().length >= 2

  if (!user) return null

  return (
    <View style={[styles.container, { paddingTop: Math.max(spacing.lg, insets.top) + spacing.md }]}>
      <View style={styles.topBar}>
        <View style={styles.searchRow}>
          <Search size={iconSizes.inline} color={colors.textMuted} strokeWidth={2} style={styles.searchIcon} />
          <TextInput
            style={styles.searchBar}
            placeholder="Search for friends by name..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={() => Keyboard.dismiss()}
          />
        </View>
        <NotificationsBellButton />
      </View>

      {isSearching ? (
        <View style={styles.searchSection}>
          {searchLoading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={styles.searchingText}>Searching...</Text>
            </View>
          ) : searchResults.length === 0 ? (
            <View style={styles.center}>
              <Text style={styles.emptySearchText}>No users found</Text>
            </View>
          ) : (
            <ScrollView
              style={styles.searchList}
              contentContainerStyle={styles.searchListContent}
              keyboardShouldPersistTaps="handled"
            >
              {searchResults.map((u) => {
                const status = followStatusMap.get(u.id) || 'none'
                const loading = followLoading === u.id
                const label = loading ? '...' : status === 'following' ? 'Following' : status === 'pending' ? 'Requested' : 'Follow'
                return (
                  <View key={u.id} style={styles.searchItem}>
                    <View style={styles.searchItemLeft}>
                      <View style={styles.avatarWrap}>
                        {u.avatar_url ? (
                          <Image source={{ uri: u.avatar_url }} style={styles.avatar} />
                        ) : (
                          <Text style={styles.avatarText}>{displayName(u).slice(0, 2).toUpperCase()}</Text>
                        )}
                      </View>
                      <Text style={styles.searchItemName}>{displayName(u)}</Text>
                    </View>
                    <Pressable
                      style={[
                        styles.followBtn,
                        status === 'following' && styles.followBtnFollowing,
                        status === 'pending' && styles.followBtnPending,
                        loading && styles.followBtnDisabled,
                      ]}
                      onPress={() => handleFollow(u.id)}
                      disabled={loading}
                    >
                      <Text style={[
                        styles.followBtnText,
                        (status === 'following' || status === 'pending') && styles.followBtnTextMuted,
                      ]}>
                        {label}
                      </Text>
                    </Pressable>
                  </View>
                )
              })}
            </ScrollView>
          )}
        </View>
      ) : loading ? (
        <View style={styles.center}>
          <Text style={styles.loadingText}>Loading feed...</Text>
        </View>
      ) : feed.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Social Feed</Text>
          <Text style={styles.emptySubtitle}>
            Follow friends to see their reviews. Use the search above to find people to follow.
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.accent]} />}
        >
          {feed.map((post) => (
            <ReviewPostCard
              key={post.venue_review_id}
              post={post}
              currentUserId={user?.id}
              onLikeChange={handleLikeChange}
              onVenuePress={handleVenuePress}
            />
          ))}
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundCanvas },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  searchRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.base,
    gap: spacing.sm,
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchIcon: { marginRight: spacing.sm },
  searchBar: {
    flex: 1,
    height: 40,
    paddingHorizontal: 0,
    backgroundColor: 'transparent',
    fontSize: fontSizes.base,
    color: colors.textPrimary,
  },
  searchSection: { flex: 1 },
  searchList: { flex: 1 },
  searchListContent: { padding: spacing.base, paddingBottom: spacing['3xl'] },
  searchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  searchItemLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatarWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    overflow: 'hidden',
  },
  avatar: { width: '100%', height: '100%' },
  avatarText: { fontSize: fontSizes.sm, color: colors.textMuted, fontWeight: fontWeights.semibold },
  searchItemName: { fontSize: fontSizes.base, color: colors.textPrimary, fontWeight: fontWeights.medium },
  followBtn: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.accent,
  },
  followBtnFollowing: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  followBtnPending: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.accent },
  followBtnDisabled: { opacity: 0.6 },
  followBtnText: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
    color: colors.textOnDark,
  },
  followBtnTextMuted: { color: colors.textPrimary },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  searchingText: { marginTop: spacing.sm, fontSize: fontSizes.sm, color: colors.textMuted },
  emptySearchText: { fontSize: fontSizes.base, color: colors.textMuted },
  loadingText: { fontSize: fontSizes.sm, color: colors.textMuted },
  emptyState: { flex: 1, padding: spacing.xl, justifyContent: 'center', alignItems: 'center' },
  emptyTitle: {
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.base, paddingBottom: spacing['3xl'] },
})
