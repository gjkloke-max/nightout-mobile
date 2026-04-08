import { View, Text, StyleSheet } from 'react-native'
import { MapPin } from 'lucide-react-native'
import { colors, fontSizes, fontFamilies, spacing, iconSizes } from '../../theme'
import { truncateToWords, formatPriceLevel } from '../../utils/venueProfileUtils'
import { deriveBrowseTagPair } from '../../utils/browseVenueTags'

export default function VenueHeader({ venue }) {
  const neighborhood = (venue?.neighborhood_name || '').trim()
  const rating = venue?.rating10 != null ? Number(venue.rating10).toFixed(1) : null
  const description = truncateToWords(
    venue?.compact_summary || venue?.review_summary || venue?.editorial_summary || '',
    55
  )
  const priceLabel = formatPriceLevel(venue?.price_level)
  const { primary: typeTag, secondary: vibeTag } = deriveBrowseTagPair(venue)

  const segments = []
  if (neighborhood) segments.push({ key: 'hood', kind: 'hood', text: neighborhood.toUpperCase() })
  if (priceLabel) segments.push({ key: 'price', kind: 'price', text: priceLabel })
  if (typeTag) segments.push({ key: 'type', kind: 'tag', text: String(typeTag).toUpperCase() })
  if (vibeTag) segments.push({ key: 'vibe', kind: 'tag', text: String(vibeTag).toUpperCase() })

  return (
    <View style={styles.container}>
      <View style={styles.top}>
        <Text style={styles.name} numberOfLines={3}>
          {venue?.name || 'Unnamed Venue'}
        </Text>
        {rating != null && (
          <View style={styles.ratingBadge}>
            <Text style={styles.ratingBadgeText}>{rating}</Text>
          </View>
        )}
      </View>

      {segments.length > 0 ? (
        <View style={styles.tagRow}>
          {segments.map((seg, i) => (
            <View key={seg.key} style={styles.tagSegment}>
              {i > 0 ? <View style={styles.dot} /> : null}
              {seg.kind === 'hood' ? (
                <View style={styles.metaItem}>
                  <MapPin size={13} color={colors.textSecondary} strokeWidth={2} />
                  <Text style={styles.neighborhood}>{seg.text}</Text>
                </View>
              ) : seg.kind === 'price' ? (
                <Text style={styles.price}>{seg.text}</Text>
              ) : (
                <Text style={styles.pillTag}>{seg.text}</Text>
              )}
            </View>
          ))}
        </View>
      ) : null}

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
    height: 33,
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#be185d',
    borderWidth: 1,
    borderColor: colors.browseAccentBorder,
  },
  ratingBadgeText: {
    fontSize: fontSizes.sm,
    fontFamily: fontFamilies.frauncesSemiBold,
    color: colors.textOnDark,
  },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginBottom: spacing.base },
  tagSegment: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  neighborhood: {
    fontSize: 11,
    fontFamily: fontFamilies.interMedium,
    letterSpacing: 1.16,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.borderInput },
  price: {
    fontSize: 11,
    fontFamily: fontFamilies.interMedium,
    letterSpacing: 1.16,
    textTransform: 'uppercase',
    color: '#3f3f47',
  },
  pillTag: {
    fontSize: 11,
    fontFamily: fontFamilies.interMedium,
    letterSpacing: 1.16,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  quote: {
    marginTop: spacing.sm,
    paddingLeft: spacing.base,
    borderLeftWidth: 1,
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
