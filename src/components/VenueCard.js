import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native'
import { Image as ImageIcon } from 'lucide-react-native'
import { colors, fontSizes, fontWeights, spacing, borderRadius, iconSizes, fontFamilies } from '../theme'

function getVenueTypeName(venue) {
  const vt = Array.isArray(venue?.venue_type) ? venue.venue_type[0] : venue?.venue_type
  return vt?.venue_type_name || ''
}

function formatDescriptor(venue) {
  const parts = []
  const typeName = getVenueTypeName(venue)
  if (typeName) parts.push(typeName)
  if (venue?.neighborhood_name) parts.push(venue.neighborhood_name)
  if (venue?.rating10 != null) parts.push(`${Number(venue.rating10).toFixed(1)}/10`)
  return parts.join(' · ')
}

export default function VenueCard({ venue, onPress }) {
  const photoUrl = venue?.primary_photo_url
  const descriptor = formatDescriptor(venue)

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.imageContainer}>
        {photoUrl ? (
          <Image source={{ uri: photoUrl }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={styles.imagePlaceholder}>
            <ImageIcon size={40} color={colors.textMuted} strokeWidth={1.5} />
          </View>
        )}
      </View>
      <View style={styles.content}>
        <Text style={styles.name} numberOfLines={2}>
          {venue?.name || 'Unnamed Venue'}
        </Text>
        {descriptor ? (
          <Text style={styles.descriptor} numberOfLines={1}>
            {descriptor}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.backgroundElevated,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginBottom: spacing.base,
  },
  imageContainer: {
    height: 120,
    backgroundColor: colors.surface,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { padding: spacing.base },
  name: {
    fontSize: fontSizes.lg,
    fontFamily: fontFamilies.frauncesSemiBold,
    fontWeight: fontWeights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  descriptor: {
    fontSize: fontSizes.sm,
    fontFamily: fontFamilies.inter,
    color: colors.textSecondary,
  },
})
