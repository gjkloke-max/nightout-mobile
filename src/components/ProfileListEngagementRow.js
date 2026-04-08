import { View, Text, Pressable, Platform, StyleSheet, Share } from 'react-native'
import { Heart, Share2 } from 'lucide-react-native'
import {
  colors,
  fontSizes,
  iconSizes,
  fontFamilies,
  spacing,
  androidRipple,
  pressOpacity,
  hitSlop,
} from '../theme'

/** Like + share for list rows on friend profile (matches web ProfileListEngagementRow). */
export default function ProfileListEngagementRow({
  likeCount,
  liked,
  loading,
  likeDisabled,
  onLike,
  shareUrl,
  shareTitle,
  currentUserId,
}) {
  const handleShare = async () => {
    if (!shareUrl) return
    try {
      await Share.share({
        message: shareTitle ? `${shareTitle} — ${shareUrl}` : shareUrl,
        title: shareTitle || 'List',
      })
    } catch {
      /* cancelled */
    }
  }

  if (loading) {
    return (
      <Text style={styles.loading} accessibilityLabel="Loading">
        …
      </Text>
    )
  }

  return (
    <View style={styles.row}>
      <Pressable
        style={({ pressed }) => [styles.actionBtn, pressed && { opacity: pressOpacity.default }]}
        onPress={onLike}
        disabled={!currentUserId || likeDisabled}
        hitSlop={hitSlop.sm}
        android_ripple={Platform.OS === 'android' ? androidRipple.light : undefined}
        accessibilityLabel={liked ? 'Unlike' : 'Like'}
      >
        <Heart
          size={iconSizes.card}
          color={liked ? colors.browseAccent : colors.textMuted}
          fill={liked ? colors.browseAccent : 'transparent'}
          strokeWidth={2}
        />
        <Text style={styles.actionText}>{likeCount}</Text>
      </Pressable>
      <Pressable
        style={({ pressed }) => [styles.actionBtn, pressed && { opacity: pressOpacity.default }]}
        onPress={handleShare}
        hitSlop={hitSlop.sm}
        android_ripple={Platform.OS === 'android' ? androidRipple.light : undefined}
        accessibilityLabel="Share list"
      >
        <Share2 size={iconSizes.card} color={colors.textMuted} strokeWidth={2} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingTop: spacing.sm,
    paddingLeft: 56,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 36,
  },
  actionText: {
    fontSize: fontSizes.sm,
    fontFamily: fontFamilies.interMedium,
    color: colors.textSecondary,
  },
  loading: {
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    paddingLeft: 56,
    paddingTop: spacing.sm,
  },
})
