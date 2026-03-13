import { View, Text, Pressable, StyleSheet } from 'react-native'
import { colors, fontSizes, fontWeights, spacing } from '../../theme'

function formatReviewDate(d) {
  if (!d) return ''
  const date = new Date(d)
  const now = new Date()
  const diffDays = Math.ceil((now - date) / (1000 * 60 * 60 * 24))
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
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
        <Text style={styles.title}>Reviews</Text>
        <Text style={styles.loading}>Loading reviews...</Text>
      </View>
    )
  }

  if (!displayReviews.length) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Reviews</Text>
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
      <View style={styles.header}>
        <Text style={styles.title}>Reviews</Text>
        {onReviewClick ? (
          <Pressable style={styles.btnSecondary} onPress={onReviewClick}>
            <Text style={styles.btnSecondaryText}>
              {userReview ? 'Your review' : 'Review this place'}
            </Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.items}>
        {displayReviews.map((r, i) => (
          <View
            key={r.venue_review_id || i}
            style={[
              styles.item,
              userReview?.venue_review_id === r.venue_review_id ? styles.itemUser : null,
            ]}
          >
            <View style={styles.meta}>
              {r.rating10 != null ? (
                <Text style={styles.rating}>{Number(r.rating10).toFixed(1)}</Text>
              ) : null}
              <Text style={styles.date}>
                {r.relative_time_description || formatReviewDate(r.review_date)}
              </Text>
              {userReview?.venue_review_id === r.venue_review_id ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>Your review</Text>
                </View>
              ) : null}
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  title: { fontSize: fontSizes.base, fontWeight: '600', color: colors.textPrimary },
  loading: { fontSize: fontSizes.sm, color: colors.textMuted, marginTop: spacing.sm },
  empty: { fontSize: fontSizes.sm, color: colors.textMuted, marginBottom: spacing.lg },
  btnPrimary: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    backgroundColor: colors.accent,
    alignSelf: 'flex-start',
  },
  btnPrimaryText: { fontSize: fontSizes.sm, color: colors.textOnDark, fontWeight: '600' },
  btnSecondary: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnSecondaryText: { fontSize: fontSizes.sm, color: colors.textPrimary },
  items: { gap: spacing.lg },
  item: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  itemUser: { backgroundColor: colors.accentMuted, marginHorizontal: -spacing.base, paddingHorizontal: spacing.base, borderRadius: 8 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  rating: { fontSize: fontSizes.sm, fontWeight: '600', color: colors.textPrimary },
  date: { fontSize: fontSizes.sm, color: colors.textMuted },
  badge: { backgroundColor: colors.accent, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  badgeText: { fontSize: 10, color: colors.textOnDark, fontWeight: '600' },
  text: { fontSize: fontSizes.sm, color: colors.textSecondary, lineHeight: 22 },
})
