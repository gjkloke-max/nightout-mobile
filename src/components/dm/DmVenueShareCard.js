import { View, Text, Image, Pressable, StyleSheet } from 'react-native'
import { colors, fontFamilies, fontSizes, spacing } from '../../theme'

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

  const inner = (
    <>
      <View style={[styles.media, variant === 'thread' && styles.mediaThread]}>
        {snapshot.photoUrl ? (
          <Image source={{ uri: snapshot.photoUrl }} style={styles.img} resizeMode="cover" />
        ) : (
          <View style={[styles.img, styles.imgEmpty]} />
        )}
      </View>
      <View style={[styles.main, variant === 'thread' && styles.mainThread]}>
        <View style={styles.topRow}>
          <Text style={[styles.name, variant === 'thread' && styles.nameThread]} numberOfLines={2}>
            {snapshot.name || 'Venue'}
          </Text>
          {rating != null ? (
            <View style={[styles.ratingBadge, variant === 'thread' && styles.ratingBadgeThread]}>
              <Text style={[styles.ratingText, variant === 'thread' && styles.ratingTextThread]}>{rating}</Text>
            </View>
          ) : null}
        </View>
        {snapshot.neighborhood ? (
          <Text style={[styles.hood, variant === 'thread' && styles.hoodThread]} numberOfLines={1}>
            {snapshot.neighborhood}
          </Text>
        ) : null}
        {tags.length > 0 ? (
          <View style={styles.tags}>
            {tags.map((t, i) => (
              <Text key={i} style={[styles.tag, variant === 'thread' && styles.tagThread]} numberOfLines={1}>
                {String(t).toUpperCase()}
              </Text>
            ))}
          </View>
        ) : null}
      </View>
    </>
  )

  const rootStyle = [styles.card, variant === 'thread' && styles.cardThread, style]

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

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    backgroundColor: colors.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  cardThread: {
    padding: 10,
    gap: 10,
  },
  pressed: { opacity: 0.92 },
  media: {
    width: 128,
    height: 128,
    backgroundColor: colors.backgroundMuted,
    overflow: 'hidden',
  },
  mediaThread: {
    width: 72,
    height: 72,
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
  mainThread: {
    minHeight: 72,
    justifyContent: 'center',
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
  nameThread: {
    fontSize: fontSizes.base,
    lineHeight: 22,
  },
  hood: {
    marginTop: 4,
    fontFamily: fontFamilies.frauncesItalic,
    fontSize: fontSizes.sm,
    lineHeight: 20,
    color: '#52525c',
  },
  hoodThread: {
    fontSize: fontSizes.xs,
    lineHeight: 16,
    marginTop: 2,
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
  tagThread: {
    fontSize: 9,
    lineHeight: 12,
    marginTop: 0,
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
  ratingBadgeThread: {
    paddingHorizontal: 6,
    minHeight: 18,
  },
  ratingText: {
    fontFamily: fontFamilies.frauncesSemiBold,
    fontSize: 11,
    color: colors.textOnDark,
  },
  ratingTextThread: {
    fontSize: 10,
  },
})
