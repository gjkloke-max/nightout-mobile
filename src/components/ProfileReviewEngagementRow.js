import { View, Text, Pressable, Platform, StyleSheet } from 'react-native'
import { Heart, MessageCircle } from 'lucide-react-native'
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

/**
 * Likes + comments row for profile review cards (matches ReviewPostCard / Figma profile reviews).
 */
export default function ProfileReviewEngagementRow({
  likeCount,
  commentCount,
  liked,
  loading,
  onLike,
  onCommentPress,
  currentUserId,
}) {
  if (loading) {
    return (
      <Text style={styles.loading} accessibilityLabel="Loading engagement">
        …
      </Text>
    )
  }

  return (
    <View style={styles.row}>
      <Pressable
        style={({ pressed }) => [styles.actionBtn, pressed && { opacity: pressOpacity.default }]}
        onPress={onLike}
        disabled={!currentUserId}
        hitSlop={hitSlop.sm}
        android_ripple={Platform.OS === 'android' ? androidRipple.light : undefined}
        accessibilityLabel={liked ? 'Unlike' : 'Like'}
        accessibilityState={{ disabled: !currentUserId }}
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
        onPress={onCommentPress}
        hitSlop={hitSlop.sm}
        android_ripple={Platform.OS === 'android' ? androidRipple.light : undefined}
        accessibilityLabel="Comments"
      >
        <MessageCircle size={iconSizes.card} color={colors.textMuted} strokeWidth={2} />
        <Text style={styles.actionText}>{commentCount}</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.lg,
    paddingTop: spacing.xs,
    marginTop: 2,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 40,
    paddingVertical: spacing.sm,
    paddingRight: spacing.sm,
  },
  actionText: {
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    fontFamily: fontFamilies.inter,
    lineHeight: 20,
  },
  loading: {
    marginTop: spacing.xs,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
  },
})
