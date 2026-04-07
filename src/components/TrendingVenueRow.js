import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native'
import { colors, fontSizes, fontWeights, spacing, fontFamilies } from '../theme'
import { deriveBrowseTagPair } from '../utils/browseVenueTags'

function formatRating10(venue) {
  const r = venue?.rating10
  if (r == null || Number.isNaN(Number(r))) return '—'
  return Number(r).toFixed(1)
}

/**
 * Same layout as Browse “Hot Right Now” trending rows (Figma / saved places on profile).
 */
export default function TrendingVenueRow({ venue, onPress }) {
  const { primary: tagPrimary, secondary: tagSecondary } = deriveBrowseTagPair(venue || {})
  return (
    <TouchableOpacity style={styles.cardRow} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.cardImageWrap}>
        {venue?.primary_photo_url ? (
          <Image source={{ uri: venue.primary_photo_url }} style={styles.cardImage} />
        ) : (
          <View style={[styles.cardImage, styles.cardImagePh]} />
        )}
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardName} numberOfLines={2} ellipsizeMode="tail">
            {venue?.name || 'Unknown'}
          </Text>
          <View style={styles.ratingBadge}>
            <Text style={styles.ratingBadgeText}>{formatRating10(venue)}</Text>
          </View>
        </View>
        {venue?.neighborhood_name ? (
          <Text style={styles.cardHood} numberOfLines={1} ellipsizeMode="tail">
            {String(venue.neighborhood_name)}
          </Text>
        ) : null}
        <View style={styles.cardTagsRow}>
          <Text style={styles.cardTag} numberOfLines={1}>
            {tagPrimary.toUpperCase()}
          </Text>
          <Text style={styles.cardTag} numberOfLines={1}>
            {tagSecondary.toUpperCase()}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  cardRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginBottom: spacing.xl,
    minHeight: 112,
  },
  cardImageWrap: {
    width: 112,
    height: 112,
    flexShrink: 0,
    backgroundColor: colors.backgroundMuted,
    overflow: 'hidden',
  },
  cardImage: {
    width: 112,
    height: 112,
  },
  cardImagePh: {
    backgroundColor: colors.surface,
  },
  cardBody: {
    flex: 1,
    marginLeft: spacing.base,
    justifyContent: 'center',
    minHeight: 112,
    paddingVertical: 2,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  cardName: {
    flex: 1,
    fontSize: fontSizes['2xl'],
    fontFamily: fontFamilies.frauncesRegular,
    fontWeight: fontWeights.normal,
    color: colors.textPrimary,
    lineHeight: fontSizes['2xl'],
  },
  ratingBadge: {
    minWidth: 36,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderWidth: 1.33,
    borderColor: colors.browseAccentBorder,
    backgroundColor: colors.browseAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingBadgeText: {
    fontSize: fontSizes.meta,
    fontFamily: fontFamilies.fraunces,
    fontWeight: fontWeights.bold,
    color: colors.textOnDark,
    letterSpacing: -0.275,
  },
  cardHood: {
    fontSize: fontSizes.sm,
    fontFamily: fontFamilies.frauncesItalic,
    fontStyle: 'italic',
    color: colors.textSecondary,
    marginTop: 4,
    lineHeight: 20,
  },
  cardTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: 8,
    alignItems: 'center',
  },
  cardTag: {
    fontSize: fontSizes.micro,
    fontFamily: fontFamilies.interMedium,
    fontWeight: fontWeights.medium,
    letterSpacing: 0.5,
    color: colors.textTag,
    textTransform: 'uppercase',
  },
})
