import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import { colors, fontSizes, fontWeights, spacing } from '../../theme'
import { filterGenericVenueType } from '../../utils/venueProfileUtils'

export default function VenueHeader({
  venue,
  user,
  onAddToList,
  onToggleFavorite,
  isFavorited,
  togglingFavorite,
}) {
  const venueType = Array.isArray(venue?.venue_type) ? venue.venue_type[0] : venue?.venue_type
  const rawTypeName = venueType?.venue_type_name || ''
  const typeName = filterGenericVenueType(rawTypeName)
  const neighborhood = venue?.neighborhood_name || ''
  const rating = venue?.rating10 != null ? Number(venue.rating10).toFixed(1) : null
  const descriptorParts = [typeName, neighborhood, rating ? `${rating}/10` : ''].filter(Boolean)
  const descriptor = descriptorParts.join(' · ')

  return (
    <View style={styles.container}>
      <Text style={styles.name}>{venue?.name || 'Unnamed Venue'}</Text>
      {descriptor ? <Text style={styles.descriptor}>{descriptor}</Text> : null}
      {venue?.status === 'temporarily_closed' ? (
        <Text style={styles.status}>Temporarily closed</Text>
      ) : null}
      {user?.id ? (
        <View style={styles.actions}>
          <Pressable style={styles.btnSecondary} onPress={() => onAddToList?.({ id: venue?.venue_id, name: venue?.name })}>
            <Text style={styles.btnSecondaryText}>Add to list</Text>
          </Pressable>
          <Pressable
            style={styles.favorite}
            onPress={() => onToggleFavorite?.(venue?.venue_id)}
            disabled={togglingFavorite === venue?.venue_id}
          >
            {togglingFavorite === venue?.venue_id ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <Text style={styles.favoriteIcon}>{isFavorited ? '❤️' : '♡'}</Text>
            )}
          </Pressable>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: spacing.base, paddingVertical: spacing.lg },
  name: {
    fontSize: fontSizes['2xl'],
    fontWeight: fontWeights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  descriptor: { fontSize: fontSizes.sm, color: colors.textMuted, marginBottom: spacing.sm },
  status: { fontSize: fontSizes.sm, color: colors.warning, marginBottom: spacing.sm },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  btnSecondary: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnSecondaryText: { fontSize: fontSizes.sm, color: colors.textPrimary, fontWeight: fontWeights.medium },
  favorite: { padding: spacing.sm, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  favoriteIcon: { fontSize: 24 },
})
