import { View, Text, Pressable, StyleSheet } from 'react-native'
import { MoreHorizontal } from 'lucide-react-native'
import { colors, fontSizes, fontFamilies, spacing, iconSizes } from '../../theme'

function formatReviewDate(d) {
  if (!d) return ''
  const date = new Date(d)
  const now = new Date()
  const diffDays = Math.ceil((now - date) / (1000 * 60 * 60 * 24))
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

function getReviewerName(r) {
  return r.profile?.first_name && r.profile?.last_name
    ? `${r.profile.first_name} ${r.profile.last_name}`
    : 'Reviewer'
}

export default function VenueReviewList({
  reviews = [],
  loading,
  userReview,
  onReviewClick,
}) {
  const displayReviews = [...reviews]
  if (userReview && !displayReviews.some((r) => r.venue_review_id === userReview.venue_review_id)) {
    displayReviews.unshift(userReview)
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Recent Reviews</Text>
        <Text style={styles.loading}>Loading reviews...</Text>
      </View>
    )
  }

  if (!displayReviews.length) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Recent Reviews</Text>
        <Text style={styles.empty}>No reviews yet.</Text>
        {onReviewClick ? (
          <Pressable style={styles.btnPrimary} onPress={onReviewClick}>
            <Text style={styles.btnPrimaryText}>Be the first to review</Text>
          </Pressable>
        ) : null}
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Recent Reviews</Text>
      <View style={styles.items}>
        {displayReviews.map((r, i) => (
          <View
            key={r.venue_review_id || i}
            style={[
              styles.item,
              userReview?.venue_review_id === r.venue_review_id ? styles.itemUser : null,
            ]}
          >
            <View style={styles.top}>
              <View style={styles.author}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{getReviewerName(r).charAt(0)}</Text>
                </View>
                <View style={styles.meta}>
                  <Text style={styles.name}>{getReviewerName(r)}</Text>
                  <Text style={styles.date}>
                    {r.relative_time_description || formatReviewDate(r.review_date)}
                  </Text>
                </View>
              </View>
              <View style={styles.right}>
                {r.rating10 != null && (
                  <View style={styles.ratingBadge}>
                    <Text style={styles.ratingBadgeText}>{Number(r.rating10).toFixed(1)}</Text>
                  </View>
                )}
                <MoreHorizontal size={iconSizes.card} color={colors.textMuted} strokeWidth={2} />
              </View>
            </View>
            {r.review_text ? <Text style={styles.text}>{r.review_text}</Text> : null}
          </View>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: spacing.base, paddingVertical: spacing.lg },
  title: { fontSize: fontSizes.base, fontFamily: fontFamilies.frauncesSemiBold, color: colors.textPrimary, marginBottom: spacing.md },
  loading: { fontSize: fontSizes.sm, fontFamily: fontFamilies.inter, color: colors.textMuted, marginTop: spacing.sm },
  empty: { fontSize: fontSizes.sm, fontFamily: fontFamilies.inter, color: colors.textMuted, marginBottom: spacing.lg },
  btnPrimary: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: 12,
    backgroundColor: colors.textPrimary,
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
  },
  btnPrimaryText: { fontSize: fontSizes.sm, fontFamily: fontFamilies.interSemiBold, color: '#fff' },
  items: { gap: spacing.md },
  item: {
    padding: spacing.base,
    backgroundColor: colors.surfaceLight,
    borderRadius: 12,
  },
  itemUser: {
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.xs },
  author: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: fontSizes.sm, fontFamily: fontFamilies.interSemiBold, color: colors.textMuted },
  meta: { flex: 1 },
  name: { fontSize: fontSizes.sm, fontFamily: fontFamilies.interSemiBold, color: colors.textPrimary },
  date: { fontSize: 12, fontFamily: fontFamilies.inter, color: colors.textMuted },
  right: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  ratingBadge: { backgroundColor: colors.success, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  ratingBadgeText: { fontSize: 12, fontFamily: fontFamilies.interSemiBold, color: '#fff' },
  text: { fontSize: fontSizes.sm, fontFamily: fontFamilies.inter, color: colors.textPrimary, lineHeight: 22 },
})
