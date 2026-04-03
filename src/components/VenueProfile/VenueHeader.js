import { View, Text, Pressable, StyleSheet } from 'react-native'
import { MapPin } from 'lucide-react-native'
import { colors, fontSizes, fontFamilies, spacing, iconSizes } from '../../theme'
import { truncateToWords } from '../../utils/venueProfileUtils'

export default function VenueHeader({ venue, reviewCount = 0, onReviewsClick }) {
  const neighborhood = (venue?.neighborhood_name || '').trim()
  const rating = venue?.rating10 != null ? Number(venue.rating10).toFixed(1) : null
  const description = truncateToWords(
    venue?.compact_summary || venue?.review_summary || venue?.editorial_summary || '',
    55
  )

  return (
    <View style={styles.container}>
      <View style={styles.top}>
        <Text style={styles.name} numberOfLines={2}>
          {venue?.name || 'Unnamed Venue'}
        </Text>
        {rating != null && (
          <View style={styles.ratingBadge}>
            <Text style={styles.ratingBadgeText}>{rating}</Text>
          </View>
        )}
      </View>
      {(neighborhood || reviewCount > 0) && (
        <View style={styles.metaRow}>
          {neighborhood ? (
            <View style={styles.metaItem}>
              <MapPin size={14} color={colors.textSecondary} strokeWidth={2} />
              <Text style={styles.neighborhood}>{neighborhood.toUpperCase()}</Text>
            </View>
          ) : null}
          {neighborhood && reviewCount > 0 ? <View style={styles.dot} /> : null}
          {reviewCount > 0 ? (
            <Pressable onPress={onReviewsClick} hitSlop={8}>
              <Text style={styles.reviewsLink}>
                {reviewCount} {reviewCount === 1 ? 'REVIEW' : 'REVIEWS'}
              </Text>
            </Pressable>
          ) : null}
        </View>
      )}
      {venue?.status === 'temporarily_closed' && (
        <Text style={styles.status}>Temporarily closed</Text>
      )}
      {description ? (
        <View style={styles.quote}>
          <Text style={styles.quoteMark} aria-hidden>
            "
          </Text>
          <Text style={styles.description}>{description}</Text>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.lg },
  top: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  name: {
    flex: 1,
    fontSize: 36,
    lineHeight: 40,
    fontFamily: fontFamilies.frauncesSemiBold,
    color: colors.textPrimary,
  },
  ratingBadge: {
    minWidth: 50,
    height: 36,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.browseAccent,
    borderWidth: 2,
    borderColor: colors.browseAccentBorder,
  },
  ratingBadgeText: {
    fontSize: fontSizes.sm,
    fontFamily: fontFamilies.frauncesSemiBold,
    color: colors.textOnDark,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.base,
  },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  neighborhood: {
    fontSize: 12,
    fontFamily: fontFamilies.interMedium,
    letterSpacing: 1.2,
    color: colors.textSecondary,
  },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.borderInput },
  reviewsLink: {
    fontSize: 12,
    fontFamily: fontFamilies.interMedium,
    letterSpacing: 1.2,
    textDecorationLine: 'underline',
    color: colors.textSecondary,
  },
  status: {
    fontSize: fontSizes.sm,
    fontFamily: fontFamilies.interSemiBold,
    color: colors.warning,
    marginBottom: spacing.sm,
  },
  quote: {
    marginTop: spacing.sm,
    paddingLeft: spacing.base,
    borderLeftWidth: 2,
    borderLeftColor: colors.borderInput,
    position: 'relative',
  },
  quoteMark: {
    position: 'absolute',
    left: -4,
    top: -20,
    fontSize: 60,
    lineHeight: 60,
    fontFamily: fontFamilies.frauncesSemiBold,
    color: colors.borderLight,
    opacity: 0.5,
  },
  description: {
    fontSize: 18,
    lineHeight: 29,
    fontFamily: fontFamilies.frauncesItalic,
    color: '#27272a',
  },
})
