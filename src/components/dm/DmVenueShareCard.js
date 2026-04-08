import { View, Text, Image, Pressable, StyleSheet } from 'react-native'
import { colors, fontFamilies, fontSizes, fontWeights, spacing } from '../../theme'

function formatRating(rating10) {
  if (rating10 == null || Number.isNaN(Number(rating10))) return null
  return Number(rating10).toFixed(1)
}

/**
 * @param {object} props
 * @param {object} props.snapshot
 * @param {'sheet' | 'thread'} [props.variant]
 * @param {() => void} [props.onPress]
 */
export default function DmVenueShareCard({ snapshot, variant = 'sheet', onPress, style }) {
  if (!snapshot?.venueId) return null
  const rating = formatRating(snapshot.rating10)
  const tags = Array.isArray(snapshot.tags) ? snapshot.tags.filter(Boolean).slice(0, 2) : []

  /* DM thread: match ReviewPostCard venue row + optional photo strip below */
  if (variant === 'thread') {
    const rootStyle = [styles.cardThread, style]
    const inner = (
      <>
        <View style={styles.threadText}>
          <View style={styles.topFeed}>
            <Text style={styles.nameFeed} numberOfLines={2}>
              {snapshot.name || 'Venue'}
            </Text>
            {rating != null ? (
              <View style={styles.ratingFeed}>
                <Text style={styles.ratingFeedText}>{rating}</Text>
              </View>
            ) : null}
          </View>
          {snapshot.neighborhood ? (
            <Text style={styles.metaFeed} numberOfLines={2}>
              {snapshot.neighborhood}
            </Text>
          ) : null}
          {tags.length > 0 ? (
            <View style={styles.tagsFeed}>
              {tags.map((t, i) => (
                <Text key={i} style={styles.tagFeed} numberOfLines={1}>
                  {String(t).toUpperCase()}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
        {snapshot.photoUrl ? (
          <View style={styles.threadPhoto}>
            <Image source={{ uri: snapshot.photoUrl }} style={styles.threadPhotoImg} resizeMode="cover" />
          </View>
        ) : null}
      </>
    )

    if (onPress) {
      return (
        <Pressable
          style={({ pressed }) => [...rootStyle, pressed && styles.pressed]}
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={`Open ${snapshot.name || 'venue'}`}
        >
          {inner}
        </Pressable>
      )
    }
    return <View style={rootStyle}>{inner}</View>
  }

  /* Sheet (compose modal) — horizontal layout per Figma */
  const innerSheet = (
    <>
      <View style={styles.media}>
        {snapshot.photoUrl ? (
          <Image source={{ uri: snapshot.photoUrl }} style={styles.img} resizeMode="cover" />
        ) : (
          <View style={[styles.img, styles.imgEmpty]} />
        )}
      </View>
      <View style={styles.main}>
        <View style={styles.topRow}>
          <Text style={styles.name} numberOfLines={2}>
            {snapshot.name || 'Venue'}
          </Text>
          {rating != null ? (
            <View style={styles.ratingBadge}>
              <Text style={styles.ratingText}>{rating}</Text>
            </View>
          ) : null}
        </View>
        {snapshot.neighborhood ? (
          <Text style={styles.hood} numberOfLines={1}>
            {snapshot.neighborhood}
          </Text>
        ) : null}
        {tags.length > 0 ? (
          <View style={styles.tags}>
            {tags.map((t, i) => (
              <Text key={i} style={styles.tag} numberOfLines={1}>
                {String(t).toUpperCase()}
              </Text>
            ))}
          </View>
        ) : null}
      </View>
    </>
  )

  const rootSheet = [styles.cardSheet, style]

  if (onPress) {
    return (
      <Pressable
        style={({ pressed }) => [...rootSheet, pressed && styles.pressed]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Open ${snapshot.name || 'venue'}`}
      >
        {innerSheet}
      </Pressable>
    )
  }

  return <View style={rootSheet}>{innerSheet}</View>
}

const styles = StyleSheet.create({
  cardSheet: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    backgroundColor: colors.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  cardThread: {
    flexDirection: 'column',
    alignSelf: 'stretch',
    width: '100%',
    backgroundColor: colors.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    overflow: 'hidden',
  },
  pressed: { opacity: 0.92 },
  threadText: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  topFeed: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  nameFeed: {
    flex: 1,
    minWidth: 0,
    fontFamily: fontFamilies.frauncesSemiBold,
    fontSize: 18,
    lineHeight: 23,
    color: colors.textPrimary,
  },
  ratingFeed: {
    flexShrink: 0,
    borderWidth: 1,
    borderColor: colors.browseAccentBorder,
    backgroundColor: colors.browseAccent,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  ratingFeedText: {
    fontFamily: fontFamilies.fraunces,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textOnDark,
    letterSpacing: -0.3,
  },
  metaFeed: {
    marginTop: 4,
    fontSize: fontSizes.meta,
    fontFamily: fontFamilies.interBold,
    fontWeight: fontWeights.bold,
    letterSpacing: 0.75,
    textTransform: 'uppercase',
    color: colors.textSecondary,
    lineHeight: 14,
  },
  tagsFeed: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tagFeed: {
    fontSize: fontSizes.micro,
    fontFamily: fontFamilies.interBold,
    letterSpacing: 0.75,
    textTransform: 'uppercase',
    color: colors.textTag,
  },
  threadPhoto: {
    width: '100%',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.backgroundMuted,
  },
  threadPhotoImg: {
    width: '100%',
    height: 132,
  },
  media: {
    width: 128,
    height: 128,
    backgroundColor: colors.backgroundMuted,
    overflow: 'hidden',
  },
  img: { width: '100%', height: '100%' },
  imgEmpty: { backgroundColor: colors.borderInput },
  main: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'space-between',
    minHeight: 128,
    paddingVertical: 4,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  name: {
    flex: 1,
    fontFamily: fontFamilies.frauncesRegular,
    fontSize: fontSizes['2xl'],
    lineHeight: 30,
    color: colors.textPrimary,
  },
  hood: {
    marginTop: 4,
    fontFamily: fontFamilies.frauncesItalic,
    fontSize: fontSizes.sm,
    lineHeight: 20,
    color: '#52525c',
  },
  tags: { marginTop: 4, gap: 4 },
  tag: {
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.micro,
    lineHeight: 15,
    letterSpacing: 0.9,
    color: colors.textTag,
    textTransform: 'uppercase',
  },
  ratingBadge: {
    paddingHorizontal: 9,
    paddingVertical: 2,
    backgroundColor: '#9d174d',
    borderWidth: 1,
    borderColor: '#831843',
    justifyContent: 'center',
    minHeight: 22,
  },
  ratingText: {
    fontFamily: fontFamilies.frauncesSemiBold,
    fontSize: 11,
    color: colors.textOnDark,
  },
})
