import { useState, useEffect } from 'react'
import { View, Text, StyleSheet, ScrollView, TextInput, RefreshControl } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useAuth } from '../contexts/AuthContext'
import { getSocialFeed } from '../services/socialFeed'
import ReviewPostCard from '../components/ReviewPostCard'
import { colors, fontSizes, spacing } from '../theme'

export default function SocialScreen() {
  const navigation = useNavigation()
  const { user } = useAuth()
  const [feed, setFeed] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const loadFeed = async () => {
    if (!user?.id) return
    const data = await getSocialFeed(user.id)
    setFeed(data)
  }

  useEffect(() => {
    loadFeed().finally(() => setLoading(false))
  }, [user?.id])

  const onRefresh = async () => {
    setRefreshing(true)
    await loadFeed()
    setRefreshing(false)
  }

  const handleVenuePress = (venue) => {
    const root = navigation.getParent()?.getParent?.()
    root?.navigate?.('VenueProfile', { venueId: venue?.venue_id })
  }

  const handleLikeChange = () => {
    loadFeed()
  }

  if (!user) return null

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.searchBar}
        placeholder="Search people..."
        placeholderTextColor={colors.textMuted}
        value={searchQuery}
        onChangeText={setSearchQuery}
      />
      {loading ? (
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
  container: { flex: 1, backgroundColor: colors.background },
  searchBar: {
    height: 44,
    backgroundColor: colors.surfaceLight,
    margin: spacing.base,
    borderRadius: 10,
    paddingHorizontal: spacing.base,
    fontSize: fontSizes.base,
    color: colors.textPrimary,
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: fontSizes.sm, color: colors.textMuted },
  emptyState: { flex: 1, padding: spacing.xl, justifyContent: 'center', alignItems: 'center' },
  emptyTitle: {
    fontSize: fontSizes.xl,
    fontWeight: '600',
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
