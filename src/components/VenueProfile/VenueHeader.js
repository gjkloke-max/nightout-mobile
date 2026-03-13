import { View, Text, Pressable, StyleSheet } from 'react-native'
import { colors, fontSizes, fontFamilies, spacing } from '../../theme'
import { truncateToWords } from '../../utils/venueProfileUtils'

export default function VenueHeader({
  venue,
  reviewCount = 0,
  onReviewsClick,
}) {
  const neighborhood = venue?.neighborhood_name || ''
  const rating = venue?.rating10 != null ? Number(venue.rating10).toFixed(1) : null
  const description = truncateToWords(venue?.compact_summary || venue?.review_summary || venue?.editorial_summary || '', 40)

  return (
    <View style={styles.container}>
      <View style={styles.top}>
        <Text style={styles.name}>{venue?.name || 'Unnamed Venue'}</Text>
        {rating != null && (
          <View style={styles.ratingBadge}>
            <Text style={styles.ratingBadgeText}>{rating}</Text>
          </View>
        )}
      </View>
      {(neighborhood || reviewCount > 0) && (
        <Text style={styles.location}>
          {neighborhood}
          {reviewCount > 0 && (
            <Text style={styles.reviewsLink} onPress={onReviewsClick}>
              {neighborhood ? ' · ' : ''}{reviewCount} {reviewCount === 1 ? 'review' : 'reviews'}
            </Text>
          )}
        </Text>
      )}
      {venue?.status === 'temporarily_closed' && (
        <Text style={styles.status}>Temporarily closed</Text>
      )}
      {description ? (
        <Text style={styles.description}>{description}</Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: spacing.base, paddingVertical: spacing.lg },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap', marginBottom: spacing.xs },
  name: {
    fontSize: fontSizes.xl,
    fontFamily: fontFamilies.fraunces,
    color: colors.textPrimary,
  },
  ratingBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: colors.success,
  },
  ratingBadgeText: { fontSize: fontSizes.sm, fontFamily: fontFamilies.interSemiBold, color: '#fff' },
  location: { fontSize: fontSizes.sm, fontFamily: fontFamilies.interMedium, color: colors.textMuted, marginBottom: spacing.xs },
  reviewsLink: { textDecorationLine: 'underline' },
  status: { fontSize: fontSizes.sm, fontFamily: fontFamilies.interSemiBold, color: colors.warning, marginBottom: spacing.sm },
  description: {
    fontSize: fontSizes.base,
    fontFamily: fontFamilies.frauncesItalic,
    color: colors.textPrimary,
    marginTop: spacing.sm,
    lineHeight: 22,
  },
})
