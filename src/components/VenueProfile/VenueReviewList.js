import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import { colors, fontSizes, fontFamilies, spacing, borderRadius } from '../../theme'

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

function ReviewHeader({ totalReviewCount }) {
  const count =
    typeof totalReviewCount === 'number' ? (
      <Text style={styles.countText}>({totalReviewCount})</Text>
    ) : null
  return (
    <View style={styles.titleRow}>
      <Text style={styles.sectionTitle}>Recent Reviews</Text>
      {count}
      <View style={styles.titleRule} />
    </View>
  )
}

export default function VenueReviewList({
  reviews = [],
  loading,
  userReview,
  onReviewClick,
  currentUserId,
  onReviewerPress,
  hasMoreReviews = false,
  loadingMoreReviews = false,
  onLoadMoreReviews,
  totalReviewCount,
}) {
  const displayReviews = [...reviews]
  if (userReview && !displayReviews.some((r) => r.venue_review_id === userReview.venue_review_id)) {
    displayReviews.unshift(userReview)
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <ReviewHeader totalReviewCount={totalReviewCount} />
        <Text style={styles.loading}>Loading reviews...</Text>
      </View>
    )
  }

  if (!displayReviews.length) {
    return (
      <View style={styles.container}>
        <ReviewHeader totalReviewCount={typeof totalReviewCount === 'number' ? totalReviewCount : 0} />
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
      <ReviewHeader totalReviewCount={totalReviewCount} />
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
      {hasMoreReviews && onLoadMoreReviews ? (
        <Pressable
          style={[styles.loadMoreBtn, loadingMoreReviews && styles.loadMoreBtnDisabled]}
          onPress={onLoadMoreReviews}
          disabled={loadingMoreReviews}
          accessibilityRole="button"
          accessibilityLabel="Load more reviews"
        >
          {loadingMoreReviews ? (
            <ActivityIndicator size="small" color={colors.textPrimary} />
          ) : (
            <Text style={styles.loadMoreText}>See more reviews</Text>
          )}
        </Pressable>
      ) : null}
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
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg, gap: 6 },
  sectionTitle: {
    fontSize: 14,
    fontFamily: fontFamilies.interBold,
    letterSpacing: 1.25,
    color: colors.textPrimary,
    textTransform: 'uppercase',
  },
  countText: {
    fontSize: 11,
    fontFamily: fontFamilies.inter,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: colors.textTag,
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
    fontSize: 10,
    fontFamily: fontFamilies.interBold,
    letterSpacing: 1.1,
    color: colors.textPrimary,
  },
  date: { fontSize: 12, fontFamily: fontFamilies.inter, color: colors.textTag, marginTop: 2 },
  ratingBadge: {
    minWidth: 38,
    height: 25,
    paddingHorizontal: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#be185d',
    borderWidth: 1,
    borderColor: colors.browseAccentBorder,
  },
  ratingBadgeText: {
    fontSize: 12,
    fontFamily: fontFamilies.frauncesSemiBold,
    color: colors.textOnDark,
  },
  text: {
    fontSize: fontSizes.base,
    lineHeight: 26,
    fontFamily: fontFamilies.frauncesItalic,
    color: '#27272a',
  },
  loadMoreBtn: {
    marginTop: spacing.lg,
    alignSelf: 'flex-start',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.borderInput,
    backgroundColor: colors.backgroundElevated,
  },
  loadMoreBtnDisabled: { opacity: 0.7 },
  loadMoreText: {
    fontSize: fontSizes.sm,
    fontFamily: fontFamilies.interSemiBold,
    color: colors.textPrimary,
  },
})
