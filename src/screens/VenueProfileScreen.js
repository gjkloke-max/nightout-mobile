import { useState, useEffect, useRef } from 'react'
import { View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator } from 'react-native'
import { useRoute, useNavigation } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '../lib/supabase'
import { fetchVenueById } from '../lib/venueService'
import { addFavorite, removeFavorite, getFavoriteVenueIds } from '../utils/favorites'
import { uploadReviewPhotos } from '../lib/reviewPhotoStorage'
import { useAuth } from '../contexts/AuthContext'
import AddToListModal from '../components/AddToListModal'
import VenueHeroGallery from '../components/VenueProfile/VenueHeroGallery'
import VenuePhotoViewer from '../components/VenueProfile/VenuePhotoViewer'
import VenueHeader from '../components/VenueProfile/VenueHeader'
import VenueActionBar from '../components/VenueProfile/VenueActionBar'
import VenueCrowdSentimentSection from '../components/VenueProfile/VenueCrowdSentimentSection'
import VenueReviewList from '../components/VenueProfile/VenueReviewList'
import VenueReviewComposer from '../components/VenueProfile/VenueReviewComposer'
import { X } from 'lucide-react-native'
import { colors, fontSizes, fontFamilies, spacing, iconSizes } from '../theme'

export default function VenueProfileScreen() {
  const route = useRoute()
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const venueId = route?.params?.venueId

  const [venue, setVenue] = useState(null)
  const [loading, setLoading] = useState(true)
  const [venueReviews, setVenueReviews] = useState([])
  const [loadingReviews, setLoadingReviews] = useState(false)
  const [favoriteVenueIds, setFavoriteVenueIds] = useState(new Set())
  const [togglingFavorite, setTogglingFavorite] = useState(null)
  const [addToListVenue, setAddToListVenue] = useState(null)
  const [photoViewerIndex, setPhotoViewerIndex] = useState(null)
  const [showReviewComposer, setShowReviewComposer] = useState(false)
  const scrollRef = useRef(null)
  const reviewsLayoutRef = useRef({ y: 0 })

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

  useEffect(() => {
    if (!venueId || !supabase) return
    setLoadingReviews(true)
    supabase
      .from('venue_review')
      .select('venue_review_id, rating10, review_text, review_date, relative_time_description, user_id')
      .eq('venue_id', venueId)
      .order('review_date', { ascending: false })
      .limit(15)
      .then(({ data }) => {
        setVenueReviews(data || [])
        setLoadingReviews(false)
      })
  }, [venueId])

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

  const handleReviewSubmit = async ({ venueId: vid, rating, text, photos = [] }) => {
    if (!user?.id) return
    const existing = venueReviews.find((r) => r.user_id === user.id)
    let reviewId

    if (existing) {
      reviewId = existing.venue_review_id
      const { error } = await supabase
        .from('venue_review')
        .update({
          rating10: Number(rating),
          review_text: text?.trim() || null,
          review_date: new Date().toISOString(),
        })
        .eq('venue_review_id', existing.venue_review_id)
      if (error) throw error
      setVenueReviews((prev) =>
        prev.map((r) =>
          r.venue_review_id === existing.venue_review_id
            ? { ...r, rating10: Number(rating), review_text: text?.trim(), review_date: new Date().toISOString() }
            : r
        )
      )
    } else {
      const { data, error } = await supabase
        .from('venue_review')
        .insert({
          venue_id: vid,
          user_id: user.id,
          rating10: Number(rating),
          review_text: text?.trim() || null,
          review_date: new Date().toISOString(),
        })
        .select('venue_review_id, rating10, review_text, review_date, relative_time_description, user_id')
        .single()
      if (error) throw error
      reviewId = data?.venue_review_id
      setVenueReviews((prev) => [data, ...prev])
    }

    if (photos?.length > 0 && reviewId) {
      const urls = await uploadReviewPhotos(photos, user.id, reviewId)
      if (urls.length > 0) {
        await supabase
          .from('review_photos')
          .insert(urls.map((photo_url) => ({ review_id: reviewId, photo_url })))
      }
    }

    setShowReviewComposer(false)
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

        <VenueHeroGallery photos={photos} onPhotoClick={(i) => setPhotoViewerIndex(i)} venueName={venue.name} />

        <VenueHeader
          venue={venue}
          reviewCount={venueReviews.length}
          onReviewsClick={() => scrollRef.current?.scrollTo({ y: reviewsLayoutRef.current.y, animated: true })}
        />

        <VenueActionBar
          venue={venue}
          user={user}
          onAddToList={handleAddToList}
          onReview={() => setShowReviewComposer(true)}
          onToggleFavorite={handleToggleFavorite}
          isFavorited={favoriteVenueIds.has(venue.venue_id)}
          togglingFavorite={togglingFavorite}
          hasUserReview={!!userReview}
        />

        {showReviewComposer ? (
          <VenueReviewComposer
            venueId={venue.venue_id}
            venueName={venue.name}
            existingReview={userReview}
            onSubmit={handleReviewSubmit}
            onCancel={() => setShowReviewComposer(false)}
          />
        ) : null}

        <VenueCrowdSentimentSection venue={venue} reviews={venueReviews} />

        <View onLayout={(e) => { reviewsLayoutRef.current.y = e.nativeEvent.layout.y }}>
          <VenueReviewList
          reviews={venueReviews}
          loading={loadingReviews}
          userReview={userReview}
          onReviewClick={() => setShowReviewComposer(true)}
        />
        </View>
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
