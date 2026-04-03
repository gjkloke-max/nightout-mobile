import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native'
import { Image as ImageIcon } from 'lucide-react-native'
import { colors, fontSizes, fontFamilies, spacing } from '../theme'

function getVenueTypeName(venue) {
  const vt = Array.isArray(venue?.venue_type) ? venue?.venue_type[0] : venue?.venue_type
  return vt?.venue_type_name || ''
}

function formatNeighborhoodLine(venue) {
  const parts = []
  const typeName = getVenueTypeName(venue)
  if (typeName) parts.push(typeName.toUpperCase())
  if (venue?.neighborhood_name) parts.push(venue.neighborhood_name.toUpperCase())
  return parts.join(' · ')
}

export default function VenueCard({ venue, onPress }) {
  const photoUrl = venue?.primary_photo_url
  const rating = venue?.rating10 != null ? Number(venue.rating10).toFixed(1) : null
  const meta = formatNeighborhoodLine(venue)

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.imageContainer}>
        {photoUrl ? (
          <Image source={{ uri: photoUrl }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={styles.imagePlaceholder}>
            <ImageIcon size={40} color={colors.textMuted} strokeWidth={1.5} />
          </View>
        )}
      </View>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.name} numberOfLines={2}>
            {venue?.name || 'Unnamed Venue'}
          </Text>
          {rating != null && (
            <View style={styles.ratingBadge}>
              <Text style={styles.ratingText}>{rating}</Text>
            </View>
          )}
        </View>
        {meta ? (
          <Text style={styles.meta} numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.backgroundElevated,
    borderWidth: 2,
    borderColor: colors.borderLight,
    borderRadius: 0,
    overflow: 'hidden',
    marginBottom: spacing.base,
  },
  imageContainer: {
    height: 140,
    backgroundColor: colors.backgroundDark,
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
  body: { padding: spacing.base },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  name: {
    flex: 1,
    fontSize: fontSizes.lg,
    fontFamily: fontFamilies.frauncesSemiBold,
    color: colors.textPrimary,
    lineHeight: 24,
  },
  ratingBadge: {
    minWidth: 44,
    height: 32,
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.browseAccent,
    borderWidth: 2,
    borderColor: colors.browseAccentBorder,
  },
  ratingText: {
    fontSize: fontSizes.sm,
    fontFamily: fontFamilies.frauncesSemiBold,
    color: colors.textOnDark,
  },
  meta: {
    fontSize: 10,
    fontFamily: fontFamilies.interMedium,
    letterSpacing: 0.8,
    color: colors.textSecondary,
  },
})
