import { useState, useEffect, useRef, useCallback } from 'react'
import { View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator } from 'react-native'
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '../lib/supabase'
import { fetchVenueById } from '../lib/venueService'
import { addFavorite, removeFavorite, getFavoriteVenueIds } from '../utils/favorites'
import { useAuth } from '../contexts/AuthContext'
import AddToListModal from '../components/AddToListModal'
import VenueHeroGallery from '../components/VenueProfile/VenueHeroGallery'
import VenuePhotoViewer from '../components/VenueProfile/VenuePhotoViewer'
import VenueHeader from '../components/VenueProfile/VenueHeader'
import VenueActionBar from '../components/VenueProfile/VenueActionBar'
import VenueCrowdSentimentSection from '../components/VenueProfile/VenueCrowdSentimentSection'
import VenueReviewList from '../components/VenueProfile/VenueReviewList'
import VenueTemporarilyClosedBanner from '../components/VenueProfile/VenueTemporarilyClosedBanner'
import VenueDmShareModal from '../components/VenueProfile/VenueDmShareModal'
import { isVenueTemporarilyClosed } from '../utils/venueProfileUtils'
import { X } from 'lucide-react-native'
import { colors, fontSizes, fontFamilies, spacing, iconSizes } from '../theme'

const REVIEWS_PAGE_SIZE = 15

async function mergeReviewsWithProfiles(rows) {
  const list = rows || []
  const userIds = [...new Set(list.map((r) => r.user_id).filter(Boolean))]
  if (!userIds.length) return list
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, avatar_url')
    .in('id', userIds)
  const byId = Object.fromEntries((profiles || []).map((p) => [p.id, p]))
  return list.map((r) => ({ ...r, profile: byId[r.user_id] || null }))
}

export default function VenueProfileScreen() {
  const route = useRoute()
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const venueId = route?.params?.venueId

  const [venue, setVenue] = useState(null)
  const [loading, setLoading] = useState(true)
  const [venueReviews, setVenueReviews] = useState([])
  const [totalReviewCount, setTotalReviewCount] = useState(null)
  const [loadingReviews, setLoadingReviews] = useState(false)
  const [loadingMoreReviews, setLoadingMoreReviews] = useState(false)
  const [hasMoreReviews, setHasMoreReviews] = useState(false)
  const reviewsNextOffsetRef = useRef(0)
  const [favoriteVenueIds, setFavoriteVenueIds] = useState(new Set())
  const [togglingFavorite, setTogglingFavorite] = useState(null)
  const [addToListVenue, setAddToListVenue] = useState(null)
  const [photoViewerIndex, setPhotoViewerIndex] = useState(null)
  const [showDmShareModal, setShowDmShareModal] = useState(false)

  useEffect(() => {
    if (!venueId) return
    setLoading(true)
    fetchVenueById(venueId).then(({ data, error }) => {
      setLoading(false)
      if (!error && data) setVenue(data)
    })
  }, [venueId])

  useEffect(() => {
    if (user?.id) {
      getFavoriteVenueIds().then((ids) => setFavoriteVenueIds(new Set(ids)))
    }
  }, [user?.id])

  useFocusEffect(
    useCallback(() => {
      if (!venueId || !supabase) return
      let cancelled = false
      setLoadingReviews(true)
      reviewsNextOffsetRef.current = 0
      ;(async () => {
        const { count } = await supabase
          .from('venue_review')
          .select('*', { count: 'exact', head: true })
          .eq('venue_id', venueId)
        if (cancelled) return
        const total = typeof count === 'number' ? count : 0
        setTotalReviewCount(total)

        const { data: rows } = await supabase
          .from('venue_review')
          .select('venue_review_id, rating10, review_text, review_date, relative_time_description, user_id')
          .eq('venue_id', venueId)
          .order('review_date', { ascending: false })
          .range(0, REVIEWS_PAGE_SIZE - 1)
        if (cancelled) return
        const list = rows || []
        reviewsNextOffsetRef.current = list.length
        const merged = await mergeReviewsWithProfiles(list)
        if (cancelled) return
        setVenueReviews(merged)
        setHasMoreReviews(total > merged.length)
        setLoadingReviews(false)
      })()
      return () => {
        cancelled = true
      }
    }, [venueId])
  )

  const loadMoreReviews = useCallback(async () => {
    if (!venueId || !supabase || loadingMoreReviews || !hasMoreReviews) return
    setLoadingMoreReviews(true)
    const from = reviewsNextOffsetRef.current
    const { data: rows } = await supabase
      .from('venue_review')
      .select('venue_review_id, rating10, review_text, review_date, relative_time_description, user_id')
      .eq('venue_id', venueId)
      .order('review_date', { ascending: false })
      .range(from, from + REVIEWS_PAGE_SIZE - 1)
    const list = rows || []
    const merged = await mergeReviewsWithProfiles(list)
    setVenueReviews((prev) => {
      const seen = new Set(prev.map((r) => r.venue_review_id))
      const extra = merged.filter((r) => r.venue_review_id && !seen.has(r.venue_review_id))
      return [...prev, ...extra]
    })
    reviewsNextOffsetRef.current += list.length
    const total = totalReviewCount ?? 0
    setHasMoreReviews(reviewsNextOffsetRef.current < total)
    setLoadingMoreReviews(false)
  }, [venueId, loadingMoreReviews, hasMoreReviews, totalReviewCount])

  const handleToggleFavorite = async (vid) => {
    if (!user?.id) return
    setTogglingFavorite(vid)
    const isFavorited = favoriteVenueIds.has(vid)
    try {
      if (isFavorited) {
        const { error } = await removeFavorite(vid)
        if (!error) setFavoriteVenueIds((prev) => { const s = new Set(prev); s.delete(vid); return s })
      } else {
        const { error } = await addFavorite(vid)
        if (!error) setFavoriteVenueIds((prev) => new Set([...prev, vid]))
      }
    } catch (err) {
      console.error(err)
    } finally {
      setTogglingFavorite(null)
    }
  }

  const handleAddToList = (v) => {
    setAddToListVenue(v || { id: venue?.venue_id, name: venue?.name })
  }

  const userReview = venueReviews.find((r) => r.user_id === user?.id) || null

  const openWriteReview = () => {
    if (!venue?.venue_id) return
    navigation.navigate('WriteReview', { venueId: venue.venue_id })
  }

  const openFriendProfile = (uid) => {
    if (!uid || uid === user?.id) return
    navigation.navigate('FriendProfile', { userId: uid })
  }

  if (!venueId) {
    return (
      <View style={styles.container}>
        <Text style={styles.error}>No venue specified</Text>
      </View>
    )
  }

  if (loading && !venue) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Loading venue...</Text>
      </View>
    )
  }

  if (!venue) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Venue not found</Text>
        <Pressable style={styles.btn} onPress={() => navigation.goBack()}>
          <Text style={styles.btnText}>Go back</Text>
        </Pressable>
      </View>
    )
  }

  const photos =
    Array.isArray(venue.photo_urls) && venue.photo_urls.length > 0
      ? venue.photo_urls
      : venue.primary_photo_url
        ? [venue.primary_photo_url]
        : []

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Pressable style={[styles.closeBtn, { top: insets.top + 12 }]} onPress={() => navigation.goBack()}>
          <X size={iconSizes.header} color={colors.textPrimary} strokeWidth={2} />
        </Pressable>

        <VenueHeroGallery
          photos={photos}
          onPhotoClick={(i) => setPhotoViewerIndex(i)}
          venueName={venue.name}
          venueId={venue.venue_id}
          controlsTop={insets.top + 12}
        />

        {isVenueTemporarilyClosed(venue) ? <VenueTemporarilyClosedBanner /> : null}

        <VenueHeader venue={venue} />

        <VenueActionBar
          venue={venue}
          user={user}
          onAddToList={handleAddToList}
          onReview={openWriteReview}
          onSendVenue={() => setShowDmShareModal(true)}
          onToggleFavorite={handleToggleFavorite}
          isFavorited={favoriteVenueIds.has(venue.venue_id)}
          togglingFavorite={togglingFavorite}
          hasUserReview={!!userReview}
        />

        <VenueCrowdSentimentSection venue={venue} reviews={venueReviews} />

        <VenueReviewList
            reviews={venueReviews}
            loading={loadingReviews}
            userReview={userReview}
            onReviewClick={openWriteReview}
            currentUserId={user?.id}
            onReviewerPress={openFriendProfile}
            hasMoreReviews={hasMoreReviews}
            loadingMoreReviews={loadingMoreReviews}
            onLoadMoreReviews={loadMoreReviews}
            totalReviewCount={totalReviewCount}
          />
      </ScrollView>

      {photoViewerIndex != null && photos.length > 0 ? (
        <VenuePhotoViewer
          photos={photos}
          initialIndex={photoViewerIndex}
          onClose={() => setPhotoViewerIndex(null)}
        />
      ) : null}

      <AddToListModal
        isOpen={!!addToListVenue}
        onClose={() => setAddToListVenue(null)}
        venueId={addToListVenue?.id}
        venueName={addToListVenue?.name}
        onAdded={() => setAddToListVenue(null)}
      />

      {user?.id ? (
        <VenueDmShareModal
          visible={showDmShareModal}
          venue={venue}
          onClose={() => setShowDmShareModal(false)}
          navigation={navigation}
        />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundCanvas },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: spacing['3xl'] },
  closeBtn: {
    position: 'absolute',
    left: spacing.base,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  loadingText: { marginTop: spacing.md, fontSize: fontSizes.sm, color: colors.textMuted },
  error: { fontSize: fontSizes.base, color: colors.textSecondary, marginBottom: spacing.lg },
  btn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    backgroundColor: colors.accent,
  },
  btnText: { fontSize: fontSizes.base, color: colors.textOnDark, fontWeight: '600' },
})
