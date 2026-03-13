import { useState } from 'react'
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
import * as ImagePicker from 'expo-image-picker'
import { colors, fontSizes, fontFamilies, spacing } from '../../theme'

const MAX_PHOTOS = 5

export default function VenueReviewComposer({
  venueId,
  venueName,
  existingReview,
  onSubmit,
  onCancel,
}) {
  const [rating, setRating] = useState(String(existingReview?.rating10 ?? 8))
  const [text, setText] = useState(existingReview?.review_text ?? '')
  const [photos, setPhotos] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

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

  const handleSubmit = async () => {
    if (!onSubmit) return
    const numRating = Number(rating)
    if (isNaN(numRating) || numRating < 0 || numRating > 10) {
      setError('Rating must be between 0 and 10')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit({ venueId, rating: numRating, text, photos })
      onCancel?.()
    } catch (err) {
      setError(err?.message || 'Failed to save review')
    } finally {
      setSubmitting(false)
    }
  }

  const canAddMore = photos.length < MAX_PHOTOS

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {existingReview ? 'Edit your review' : `Review ${venueName || 'this venue'}`}
      </Text>
      <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
        <View style={styles.field}>
          <Text style={styles.label}>Rating (0–10)</Text>
          <TextInput
            style={styles.input}
            value={rating}
            onChangeText={(t) => { setRating(t); setError(null) }}
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
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <View style={styles.actions}>
          <Pressable style={styles.btnSecondary} onPress={onCancel}>
            <Text style={styles.btnSecondaryText}>Cancel</Text>
          </Pressable>
          <Pressable
            style={[styles.btnPrimary, submitting && styles.btnDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={colors.textOnDark} />
            ) : (
              <Text style={styles.btnPrimaryText}>
                {existingReview ? 'Update review' : 'Submit review'}
              </Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: spacing.base, paddingVertical: spacing.lg },
  title: {
    fontSize: fontSizes.lg,
    fontFamily: fontFamilies.frauncesSemiBold,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  form: {},
  field: { marginBottom: spacing.lg },
  label: { fontSize: fontSizes.sm, fontFamily: fontFamilies.interMedium, color: colors.textSecondary, marginBottom: spacing.xs },
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
  btnDisabled: { opacity: 0.7 },
  btnPrimaryText: { fontSize: fontSizes.base, fontFamily: fontFamilies.interSemiBold, color: colors.textOnDark },
})
