import { useState, useEffect, useRef, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  BackHandler,
} from 'react-native'
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native'
import { WRITE_REVIEW_ORIGIN } from '../navigation/writeReviewOrigin'
import { SafeAreaView } from 'react-native-safe-area-context'
import { X, Search } from 'lucide-react-native'
import { supabase } from '../lib/supabase'
import { searchVenuesByName, fetchVenueById } from '../lib/venueService'
import { uploadReviewPhotos } from '../lib/reviewPhotoStorage'
import { useAuth } from '../contexts/AuthContext'
import VenueReviewComposer from '../components/VenueProfile/VenueReviewComposer'
import { colors, fontFamilies, spacing } from '../theme'

/**
 * Root stack: Write a review — search (Profile) or preset venue (Venue detail).
 */
export default function WriteReviewScreen() {
  const navigation = useNavigation()
  const route = useRoute()
  const presetVenueId = route.params?.venueId
  const origin = route.params?.origin
  const { user } = useAuth()
  const composerRef = useRef(null)

  const [step, setStep] = useState(() => (presetVenueId ? 'compose' : 'search'))
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [selectedVenue, setSelectedVenue] = useState(null)
  const [existingReview, setExistingReview] = useState(null)
  const [composerSubmitting, setComposerSubmitting] = useState(false)
  const [canPostReview, setCanPostReview] = useState(false)
  const [presetLoading, setPresetLoading] = useState(!!presetVenueId)
  const [presetError, setPresetError] = useState(null)

  useEffect(() => {
    if (!presetVenueId) return
    let cancelled = false
    setPresetLoading(true)
    setPresetError(null)
    ;(async () => {
      const { data: venue, error } = await fetchVenueById(presetVenueId)
      if (cancelled) return
      if (error || !venue) {
        setPresetError('Could not load this venue.')
        setPresetLoading(false)
        return
      }
      setSelectedVenue(venue)
      setStep('compose')
      if (user?.id) {
        const { data: reviews } = await supabase
          .from('venue_review')
          .select('venue_review_id, rating10, review_text')
          .eq('venue_id', venue.venue_id)
          .eq('user_id', user.id)
          .limit(1)
        if (!cancelled) {
          const ex = reviews?.[0] || null
          setExistingReview(ex)
          setCanPostReview(!!(ex?.review_text || '').trim())
        }
      } else {
        setCanPostReview(false)
      }
      setPresetLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [presetVenueId, user?.id])

  useEffect(() => {
    if (presetVenueId) return
    const q = searchQuery.trim()
    if (!q) {
      setSearchResults([])
      return
    }
    const t = setTimeout(async () => {
      setSearching(true)
      const { data } = await searchVenuesByName(q, 15)
      setSearchResults(data || [])
      setSearching(false)
    }, 300)
    return () => clearTimeout(t)
  }, [searchQuery, presetVenueId])

  const handleSelectVenue = async (venue) => {
    setSelectedVenue(venue)
    if (user?.id) {
      const { data: reviews } = await supabase
        .from('venue_review')
        .select('venue_review_id, rating10, review_text')
        .eq('venue_id', venue.venue_id)
        .eq('user_id', user.id)
        .limit(1)
      const ex = reviews?.[0] || null
      setExistingReview(ex)
      setCanPostReview(!!(ex?.review_text || '').trim())
    } else {
      setCanPostReview(false)
    }
    setStep('compose')
  }

  const handleSubmitReview = useCallback(
    async ({ venueId, rating, text, photos = [] }) => {
      if (!user?.id) return
      const existing = existingReview
      let reviewId

      if (existing) {
        reviewId = existing.venue_review_id
        const { error } = await supabase
          .from('venue_review')
          .update({
            rating10: Number(rating),
            review_text: text?.trim() || null,
            review_date: new Date().toISOString(),
            mentioned_user_ids: [],
          })
          .eq('venue_review_id', existing.venue_review_id)
        if (error) throw error
      } else {
        const { data: inserted, error } = await supabase
          .from('venue_review')
          .insert({
            venue_id: venueId,
            user_id: user.id,
            rating10: Number(rating),
            review_text: text?.trim() || null,
            review_date: new Date().toISOString(),
            mentioned_user_ids: [],
          })
          .select('venue_review_id')
          .single()
        if (error) throw error
        reviewId = inserted?.venue_review_id
      }

      if (photos?.length > 0 && reviewId) {
        const urls = await uploadReviewPhotos(photos, user.id, reviewId)
        if (urls.length > 0) {
          await supabase
            .from('review_photos')
            .insert(urls.map((photo_url) => ({ review_id: reviewId, photo_url })))
        }
      }
    },
    [user?.id, existingReview]
  )

  const handleBackToSearch = () => {
    if (presetVenueId) return
    setStep('search')
    setSelectedVenue(null)
    setExistingReview(null)
    setCanPostReview(false)
  }

  const exitWriteReview = useCallback(() => {
    if (origin === WRITE_REVIEW_ORIGIN.SOCIAL_FEED) {
      navigation.navigate('MainTabs', {
        screen: 'Social',
        params: { screen: 'SocialMain' },
      })
      return
    }
    navigation.goBack()
  }, [navigation, origin])

  useFocusEffect(
    useCallback(() => {
      if (origin !== WRITE_REVIEW_ORIGIN.SOCIAL_FEED || Platform.OS !== 'android') return undefined
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        exitWriteReview()
        return true
      })
      return () => sub.remove()
    }, [origin, exitWriteReview])
  )

  const headerTitle = 'Write a Review'

  const postDisabled =
    presetLoading ||
    step === 'search' ||
    composerSubmitting ||
    (step === 'compose' && !canPostReview)

  if (presetVenueId && presetLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.presetCenter}>
          <ActivityIndicator size="large" color={colors.browseAccent} />
        </View>
      </SafeAreaView>
    )
  }

  if (presetVenueId && presetError) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.presetCenter}>
          <Text style={styles.presetError}>{presetError}</Text>
          <Pressable style={styles.presetBackBtn} onPress={exitWriteReview}>
            <Text style={styles.presetBackText}>Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <View style={styles.header}>
          <View style={[styles.headerSlot, styles.headerSlotLeft]}>
            <Pressable
              style={styles.iconBtn}
              onPress={exitWriteReview}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <X size={24} color="#18181b" strokeWidth={2} />
            </Pressable>
          </View>
          <View style={styles.headerTitleWrap} pointerEvents="none">
            <Text style={styles.headerTitle} numberOfLines={1}>
              {headerTitle}
            </Text>
          </View>
          <View style={[styles.headerSlot, styles.headerSlotEnd]}>
            <Pressable
              style={[styles.postBtn, !postDisabled && styles.postBtnActive]}
              onPress={() => {
                if (step === 'compose') composerRef.current?.submit?.()
              }}
              disabled={postDisabled}
              accessibilityRole="button"
              accessibilityLabel="Post review"
            >
              {composerSubmitting ? (
                <ActivityIndicator size="small" color={postDisabled ? '#71717b' : '#fff'} />
              ) : (
                <Text style={[styles.postBtnText, !postDisabled && styles.postBtnTextActive]}>Post</Text>
              )}
            </Pressable>
          </View>
        </View>

        <View style={styles.body}>
          {step === 'search' && (
            <>
              <View style={styles.searchBlock}>
                <Text style={styles.fieldLabel}>Search for a place</Text>
                <View style={styles.inputWrap}>
                  <Search size={18} color="#9f9fa9" style={styles.searchIcon} strokeWidth={2} />
                  <TextInput
                    style={styles.input}
                    placeholder="Restaurant name, neighborhood, or cuisine..."
                    placeholderTextColor="#9f9fa9"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    autoFocus
                    autoCorrect={false}
                    autoCapitalize="none"
                  />
                </View>
              </View>
              {searching ? (
                <Text style={styles.hint}>Searching…</Text>
              ) : null}
              {!searching && searchQuery.trim() ? (
                <ScrollView style={styles.results} keyboardShouldPersistTaps="handled">
                  {searchResults.length === 0 ? (
                    <Text style={styles.empty}>No venues found. Try a different search.</Text>
                  ) : (
                    searchResults.map((v) => {
                      const state = Array.isArray(v.state) ? v.state[0] : v.state
                      const type = Array.isArray(v.venue_type) ? v.venue_type[0] : v.venue_type
                      return (
                        <Pressable
                          key={v.venue_id}
                          style={styles.resultRow}
                          onPress={() => handleSelectVenue(v)}
                        >
                          {v.primary_photo_url ? (
                            <Image source={{ uri: v.primary_photo_url }} style={styles.resultImg} />
                          ) : (
                            <View style={[styles.resultImg, styles.resultImgPh]} />
                          )}
                          <View style={styles.resultInfo}>
                            <Text style={styles.resultName} numberOfLines={1}>
                              {v.name || 'Unnamed'}
                            </Text>
                            <Text style={styles.resultMeta} numberOfLines={2}>
                              {[type?.venue_type_name, v.city, state?.state_code].filter(Boolean).join(' · ')}
                            </Text>
                          </View>
                        </Pressable>
                      )
                    })
                  )}
                </ScrollView>
              ) : null}
            </>
          )}

          {step === 'compose' && selectedVenue ? (
            <ScrollView style={styles.composeScroll} keyboardShouldPersistTaps="handled">
              <VenueReviewComposer
                key={selectedVenue.venue_id}
                ref={composerRef}
                venueId={selectedVenue.venue_id}
                venueName={selectedVenue.name}
                venuePhotoUrl={selectedVenue.primary_photo_url}
                venueNeighborhood={selectedVenue.neighborhood_name || selectedVenue.city || ''}
                existingReview={existingReview}
                currentUserId={user?.id}
                onSubmit={handleSubmitReview}
                onCancel={exitWriteReview}
                embeddedInFlow
                onSubmittingChange={setComposerSubmitting}
                onChangePlace={presetVenueId ? undefined : handleBackToSearch}
                onPostValidityChange={setCanPostReview}
              />
            </ScrollView>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#ffffff' },
  flex: { flex: 1 },
  presetCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  presetError: {
    fontSize: 16,
    fontFamily: fontFamilies.inter,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.base,
  },
  presetBackBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  presetBackText: {
    fontSize: 16,
    fontFamily: fontFamilies.interSemiBold,
    color: colors.browseAccent,
  },
  header: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingLeft: 8,
    paddingRight: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f4f4f5',
    backgroundColor: '#ffffff',
  },
  /** Side columns keep controls tappable; title is layered full-width so it is not squeezed. */
  headerSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 1,
  },
  headerSlotLeft: {
    justifyContent: 'flex-start',
    minWidth: 44,
  },
  headerSlotEnd: {
    flex: 1,
    justifyContent: 'flex-end',
    minWidth: 72,
  },
  headerTitleWrap: {
    position: 'absolute',
    left: 48,
    right: 76,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 0,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: fontFamilies.interSemiBold,
    color: '#18181b',
    lineHeight: 26,
    textAlign: 'center',
  },
  postBtn: {
    height: 32,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(212, 212, 216, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 59,
  },
  postBtnActive: {
    backgroundColor: colors.browseAccent,
  },
  postBtnText: {
    fontSize: 14,
    fontFamily: fontFamilies.interMedium,
    fontWeight: '500',
    color: '#71717b',
  },
  postBtnTextActive: {
    color: '#ffffff',
  },
  body: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  searchBlock: {
    paddingTop: 24,
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f4f4f5',
  },
  fieldLabel: {
    marginBottom: 12,
    fontSize: 12,
    fontFamily: fontFamilies.interSemiBold,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: '#71717b',
  },
  inputWrap: {
    position: 'relative',
    justifyContent: 'center',
  },
  searchIcon: {
    position: 'absolute',
    left: 12,
    zIndex: 1,
  },
  input: {
    height: 47,
    paddingLeft: 40,
    paddingRight: 16,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: fontFamilies.inter,
    color: '#18181b',
    backgroundColor: '#fafafa',
    borderWidth: 1,
    borderColor: '#bfbfc2',
    borderRadius: 14,
  },
  hint: {
    paddingHorizontal: 20,
    paddingTop: 12,
    fontSize: 14,
    color: '#71717b',
  },
  results: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  empty: {
    textAlign: 'center',
    padding: 16,
    fontSize: 14,
    color: '#71717b',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f4f4f5',
    backgroundColor: '#ffffff',
  },
  resultImg: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  resultImgPh: {
    backgroundColor: '#f4f4f5',
  },
  resultInfo: { flex: 1, minWidth: 0 },
  resultName: {
    fontSize: 15,
    fontFamily: fontFamilies.interSemiBold,
    fontWeight: '600',
    color: '#18181b',
  },
  resultMeta: {
    fontSize: 13,
    fontFamily: fontFamilies.inter,
    color: '#71717b',
    marginTop: 4,
  },
  composeScroll: {
    flex: 1,
    overflow: 'visible',
  },
})
