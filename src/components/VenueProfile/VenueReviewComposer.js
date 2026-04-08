import { useState, useCallback, forwardRef, useImperativeHandle, useEffect, useRef } from 'react'
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Image,
  Alert,
} from 'react-native'
import Slider from '@react-native-community/slider'
import * as Haptics from 'expo-haptics'
import * as ImagePicker from 'expo-image-picker'
import { MapPin } from 'lucide-react-native'
import { colors, fontSizes, fontFamilies, spacing } from '../../theme'

const MAX_PHOTOS = 5

const REVIEW_PLACEHOLDER_EMBEDDED =
  'What did you think? How was the vibe? The service?'

const VenueReviewComposer = forwardRef(function VenueReviewComposer(
  {
    venueId,
    venueName,
    venuePhotoUrl,
    venueNeighborhood,
    existingReview,
    currentUserId: _currentUserId,
    onSubmit,
    onCancel,
    embeddedInFlow = false,
    showEmbeddedActions = false,
    onSubmittingChange,
    onChangePlace,
    onPostValidityChange,
  },
  ref
) {
  const [rating, setRating] = useState(() => Number(existingReview?.rating10 ?? 8))
  const [text, setText] = useState(existingReview?.review_text ?? '')
  const [photos, setPhotos] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const lastHapticSliderStepRef = useRef(
    Math.round(Number(existingReview?.rating10 ?? 8) * 10)
  )

  useEffect(() => {
    if (!embeddedInFlow) return
    onPostValidityChange?.(text.trim().length > 0)
  }, [embeddedInFlow, text, onPostValidityChange])

  const handleAddPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow access to photos to add images.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    })
    if (!result.canceled && result.assets?.length) {
      const newPhotos = result.assets.slice(0, MAX_PHOTOS - photos.length).map((a) => ({ uri: a.uri }))
      setPhotos((prev) => prev.concat(newPhotos).slice(0, MAX_PHOTOS))
    }
  }

  const handleRemovePhoto = (index) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = useCallback(async () => {
    if (!onSubmit) return
    const numRating = Number(rating)
    if (isNaN(numRating) || numRating < 0 || numRating > 10) {
      setError('Rating must be between 0 and 10')
      return
    }
    if (embeddedInFlow && !String(text).trim()) {
      setError('Add a few words to your review.')
      return
    }
    setSubmitting(true)
    onSubmittingChange?.(true)
    setError(null)
    try {
      await onSubmit({ venueId, rating: numRating, text, photos })
      onCancel?.()
    } catch (err) {
      setError(err?.message || 'Failed to save review')
    } finally {
      setSubmitting(false)
      onSubmittingChange?.(false)
    }
  }, [
    onSubmit,
    venueId,
    rating,
    text,
    photos,
    onCancel,
    onSubmittingChange,
    embeddedInFlow,
  ])

  useImperativeHandle(
    ref,
    () => ({
      submit: () => {
        handleSubmit()
      },
    }),
    [handleSubmit]
  )

  const canAddMore = photos.length < MAX_PHOTOS
  const ratingDisplay = Number.isFinite(Number(rating)) ? Number(rating) : 0

  const containerPad = embeddedInFlow ? styles.containerEmbedded : styles.container

  const handleSliderChange = useCallback((v) => {
    const rounded = Math.round(Number(v) * 10) / 10
    setRating(rounded)
    const step = Math.round(rounded * 10)
    if (lastHapticSliderStepRef.current !== step) {
      lastHapticSliderStepRef.current = step
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    }
  }, [])

  const renderEmbedded = () => (
    <>
      <View style={styles.embedSection}>
        <Text style={styles.embedLabel}>Place</Text>
        <View style={styles.placeCard}>
          {venuePhotoUrl ? (
            <Image source={{ uri: venuePhotoUrl }} style={styles.placeThumb} />
          ) : (
            <View style={[styles.placeThumb, styles.placeThumbPh]} />
          )}
          <View style={styles.placeInfo}>
            <Text style={styles.placeName} numberOfLines={1}>
              {venueName || 'Venue'}
            </Text>
            {venueNeighborhood ? (
              <View style={styles.placeHoodRow}>
                <MapPin size={12} color="#71717b" strokeWidth={2} />
                <Text style={styles.placeHood} numberOfLines={1}>
                  {venueNeighborhood}
                </Text>
              </View>
            ) : null}
          </View>
          {onChangePlace ? (
            <Pressable onPress={onChangePlace} hitSlop={8}>
              <Text style={styles.changeBtn}>Change</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={styles.embedSection}>
        <Text style={styles.embedLabel}>Your rating</Text>
        <View style={styles.ratingCenter}>
          <View style={styles.ratingBadgeRow}>
            <View style={styles.ratingNumBox}>
              <Text style={styles.ratingNumText}>{ratingDisplay.toFixed(1)}</Text>
            </View>
            <Text style={styles.ratingSuffix}>/10</Text>
          </View>
        </View>
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={10}
          step={0.1}
          value={ratingDisplay}
          onValueChange={handleSliderChange}
          minimumTrackTintColor={colors.browseAccent}
          maximumTrackTintColor="#f4f4f5"
          thumbTintColor={colors.browseAccent}
        />
      </View>

      <View style={styles.embedSection}>
        <Text style={styles.embedLabel}>Your review</Text>
        <TextInput
          style={styles.embedTextarea}
          value={text}
          onChangeText={setText}
          placeholder={REVIEW_PLACEHOLDER_EMBEDDED}
          placeholderTextColor="#d4d4d8"
          multiline
          textAlignVertical="top"
        />
      </View>

      <View style={[styles.embedSection, styles.embedPhotosWrap]}>
        <Pressable
          style={[styles.addPhotoDashed, !canAddMore && styles.addPhotoDisabled]}
          onPress={handleAddPhoto}
          disabled={!canAddMore}
        >
          <Text style={styles.addPhotoPlus}>+</Text>
          <Text style={styles.addPhotoCap}>Add</Text>
        </Pressable>
        <View style={styles.photosRow}>
          {photos.map((p, i) => (
            <View key={i} style={styles.photoPreview}>
              <Image source={{ uri: p.uri }} style={styles.photoImg} />
              <Pressable style={styles.photoRemove} onPress={() => handleRemovePhoto(i)}>
                <Text style={styles.photoRemoveText}>×</Text>
              </Pressable>
            </View>
          ))}
        </View>
      </View>
    </>
  )

  const renderClassic = () => (
    <>
      <View style={styles.field}>
        <Text style={styles.label}>Rating (0–10)</Text>
        <TextInput
          style={styles.input}
          value={String(rating)}
          onChangeText={(t) => {
            const n = parseFloat(t.replace(',', '.'))
            if (t === '' || t === '-') {
              setRating(0)
            } else if (!Number.isNaN(n)) {
              setRating(Math.min(10, Math.max(0, n)))
            }
            setError(null)
          }}
          keyboardType="decimal-pad"
          placeholder="8"
        />
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>Your review</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={text}
          onChangeText={(t) => setText(t)}
          placeholder="Share your experience..."
          multiline
          numberOfLines={4}
        />
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>Photos (optional)</Text>
        <View style={styles.photosRow}>
          {photos.map((p, i) => (
            <View key={i} style={styles.photoPreview}>
              <Image source={{ uri: p.uri }} style={styles.photoImg} />
              <Pressable style={styles.photoRemove} onPress={() => handleRemovePhoto(i)}>
                <Text style={styles.photoRemoveText}>×</Text>
              </Pressable>
            </View>
          ))}
          {canAddMore ? (
            <Pressable style={styles.photoAdd} onPress={handleAddPhoto}>
              <Text style={styles.photoAddText}>+ Add photo</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </>
  )

  return (
    <View style={containerPad}>
      {!embeddedInFlow && (
        <Text style={styles.title}>
          {existingReview ? 'Edit your review' : `Review ${venueName || 'this venue'}`}
        </Text>
      )}
      <ScrollView style={styles.form} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {embeddedInFlow ? renderEmbedded() : renderClassic()}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {(!embeddedInFlow || showEmbeddedActions) && (
          <View
            style={[
              styles.actions,
              embeddedInFlow && showEmbeddedActions && styles.actionsEmbedded,
            ]}
          >
            <Pressable style={styles.btnSecondary} onPress={onCancel}>
              <Text style={styles.btnSecondaryText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[
                styles.btnPrimary,
                embeddedInFlow && showEmbeddedActions && styles.btnPrimaryVenue,
                submitting && styles.btnDisabled,
              ]}
              onPress={handleSubmit}
              disabled={submitting || (embeddedInFlow && !String(text).trim())}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={colors.textOnDark} />
              ) : (
                <Text style={styles.btnPrimaryText}>
                  {embeddedInFlow && showEmbeddedActions
                    ? existingReview
                      ? 'Update'
                      : 'Post'
                    : existingReview
                      ? 'Update review'
                      : 'Submit review'}
                </Text>
              )}
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  )
})

export default VenueReviewComposer

const styles = StyleSheet.create({
  container: { paddingHorizontal: spacing.base, paddingVertical: spacing.lg },
  containerEmbedded: { paddingHorizontal: 20, paddingBottom: spacing.xl },
  title: {
    fontSize: fontSizes.lg,
    fontFamily: fontFamilies.frauncesSemiBold,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  form: {},
  embedSection: { marginBottom: spacing.lg },
  embedLabel: {
    fontSize: 12,
    fontFamily: fontFamilies.interSemiBold,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: '#71717b',
    marginBottom: 12,
  },
  placeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 13,
    backgroundColor: '#fafafa',
    borderWidth: 0.89,
    borderColor: 'rgba(228,228,231,0.6)',
    borderRadius: 16,
  },
  placeThumb: { width: 48, height: 48, borderRadius: 14 },
  placeThumbPh: { backgroundColor: '#f4f4f5' },
  placeInfo: { flex: 1, minWidth: 0 },
  placeName: {
    fontSize: 14,
    fontFamily: fontFamilies.interSemiBold,
    fontWeight: '600',
    color: '#18181b',
  },
  placeHoodRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  placeHood: { fontSize: 12, fontFamily: fontFamilies.inter, color: '#71717b', flex: 1 },
  changeBtn: { fontSize: 14, fontFamily: fontFamilies.interMedium, fontWeight: '500', color: '#2563eb' },
  ratingCenter: { alignItems: 'center', marginBottom: 8 },
  ratingBadgeRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  ratingNumBox: {
    backgroundColor: colors.browseAccent,
    borderWidth: 0.89,
    borderColor: colors.browseAccentBorder,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    minWidth: 64,
    alignItems: 'center',
  },
  ratingNumText: {
    fontSize: 24,
    fontFamily: fontFamilies.frauncesSemiBold,
    fontWeight: '700',
    color: '#fff',
  },
  ratingSuffix: {
    fontSize: 13,
    fontFamily: fontFamilies.interBold,
    fontWeight: '700',
    letterSpacing: 1,
    color: '#9f9fa9',
  },
  slider: { width: '100%', height: 40 },
  embedTextarea: {
    minHeight: 140,
    fontSize: 18,
    lineHeight: 29,
    fontFamily: fontFamilies.inter,
    color: '#18181b',
  },
  embedPhotosWrap: {
    paddingTop: 16,
    borderTopWidth: 0.89,
    borderTopColor: '#f4f4f5',
  },
  addPhotoDashed: {
    width: '100%',
    minHeight: 80,
    borderWidth: 1.78,
    borderColor: '#e4e4e7',
    borderStyle: 'dashed',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginBottom: 8,
  },
  addPhotoDisabled: { opacity: 0.5 },
  addPhotoPlus: { fontSize: 24, color: '#9f9fa9', lineHeight: 28 },
  addPhotoCap: {
    fontSize: 10,
    fontFamily: fontFamilies.interMedium,
    fontWeight: '500',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: '#9f9fa9',
  },
  field: { marginBottom: spacing.lg },
  label: {
    fontSize: fontSizes.sm,
    fontFamily: fontFamilies.interMedium,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    fontSize: fontSizes.base,
    fontFamily: fontFamilies.inter,
    color: colors.textPrimary,
    backgroundColor: colors.backgroundElevated,
  },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  photosRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  photoPreview: { width: 72, height: 72, borderRadius: 12, overflow: 'hidden', position: 'relative' },
  photoImg: { width: '100%', height: '100%' },
  photoRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoRemoveText: { color: '#fff', fontSize: 18, lineHeight: 20 },
  photoAdd: {
    width: 72,
    height: 72,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoAddText: { fontSize: fontSizes.sm, fontFamily: fontFamilies.inter, color: colors.textMuted },
  errorText: { fontSize: fontSizes.sm, fontFamily: fontFamilies.inter, color: colors.error, marginBottom: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  actionsEmbedded: {
    marginTop: spacing.lg,
    paddingTop: spacing.base,
    borderTopWidth: 1,
    borderTopColor: '#f4f4f5',
  },
  btnSecondary: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  btnSecondaryText: { fontSize: fontSizes.base, fontFamily: fontFamilies.interMedium, color: colors.textPrimary },
  btnPrimary: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 12,
    backgroundColor: colors.accent,
    alignItems: 'center',
  },
  btnPrimaryVenue: {
    backgroundColor: colors.browseAccent,
  },
  btnDisabled: { opacity: 0.7 },
  btnPrimaryText: { fontSize: fontSizes.base, fontFamily: fontFamilies.interSemiBold, color: colors.textOnDark },
})
