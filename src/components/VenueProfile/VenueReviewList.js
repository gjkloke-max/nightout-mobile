import { View, Text, Pressable, StyleSheet } from 'react-native'
import { colors, fontSizes, fontFamilies, spacing } from '../../theme'

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
  const parts = [r.profile?.first_name, r.profile?.last_name].filter(Boolean)
  if (parts.length) return parts.join(' ')
  return 'Private reviewer'
}

export default function VenueReviewList({
  reviews = [],
  loading,
  userReview,
  onReviewClick,
  currentUserId,
  onReviewerPress,
}) {
  const displayReviews = [...reviews]
  if (userReview && !displayReviews.some((r) => r.venue_review_id === userReview.venue_review_id)) {
    displayReviews.unshift(userReview)
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.sectionTitle}>Recent Reviews</Text>
        <Text style={styles.loading}>Loading reviews...</Text>
      </View>
    )
  }

  if (!displayReviews.length) {
    return (
      <View style={styles.container}>
        <Text style={styles.sectionTitle}>Recent Reviews</Text>
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
      <View style={styles.titleRow}>
        <Text style={styles.sectionTitle}>Recent Reviews</Text>
        <View style={styles.titleRule} />
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
            <View style={styles.top}>
              <Pressable
                style={styles.metaPressable}
                onPress={() =>
                  onReviewerPress && r.user_id && r.user_id !== currentUserId && onReviewerPress(r.user_id)
                }
                disabled={!onReviewerPress || !r.user_id || r.user_id === currentUserId}
              >
                <View style={styles.meta}>
                  <Text style={styles.name}>{getReviewerName(r).toUpperCase()}</Text>
                  <Text style={styles.date}>{r.relative_time_description || formatReviewDate(r.review_date)}</Text>
                </View>
              </Pressable>
              {r.rating10 != null && (
                <View style={styles.ratingBadge}>
                  <Text style={styles.ratingBadgeText}>{Number(r.rating10).toFixed(1)}</Text>
                </View>
              )}
            </View>
            {r.review_text ? <Text style={styles.text}>{r.review_text}</Text> : null}
          </View>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderTopWidth: 2,
    borderTopColor: colors.borderLight,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
  sectionTitle: {
    fontSize: 14,
    fontFamily: fontFamilies.interBold,
    letterSpacing: 1.4,
    color: colors.textPrimary,
    textTransform: 'uppercase',
    marginRight: spacing.sm,
  },
  titleRule: { flex: 1, height: 1, backgroundColor: colors.borderLight },
  loading: { fontSize: fontSizes.sm, fontFamily: fontFamilies.inter, color: colors.textMuted, marginTop: spacing.sm },
  empty: { fontSize: fontSizes.sm, fontFamily: fontFamilies.inter, color: colors.textMuted, marginBottom: spacing.lg },
  btnPrimary: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    backgroundColor: colors.backgroundDark,
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
  },
  btnPrimaryText: { fontSize: fontSizes.sm, fontFamily: fontFamilies.interSemiBold, color: '#fff' },
  items: { gap: 0 },
  item: {
    paddingVertical: spacing.lg,
    borderBottomWidth: 2,
    borderBottomColor: colors.borderLight,
  },
  itemUser: {
    backgroundColor: 'rgba(157, 23, 77, 0.06)',
    marginHorizontal: -spacing.xl,
    paddingHorizontal: spacing.xl,
  },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.sm },
  metaPressable: { flex: 1, paddingRight: spacing.sm },
  meta: { flex: 1 },
  name: {
    fontSize: 13,
    fontFamily: fontFamilies.interBold,
    letterSpacing: 0.5,
    color: colors.textPrimary,
  },
  date: { fontSize: 12, fontFamily: fontFamilies.inter, color: colors.textTag, marginTop: 2 },
  ratingBadge: {
    minWidth: 40,
    height: 32,
    paddingHorizontal: 8,
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
  text: {
    fontSize: fontSizes.base,
    lineHeight: 26,
    fontFamily: fontFamilies.frauncesItalic,
    color: '#27272a',
  },
})
