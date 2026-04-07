import { View, Text, StyleSheet } from 'react-native'
import { colors, fontSizes, fontFamilies, spacing } from '../../theme'
import { deriveCrowdSentiment } from '../../utils/venueProfileUtils'

export default function VenueCrowdSentimentSection({ venue, reviews = [] }) {
  const reviewTexts = (reviews || [])
    .map((r) => r?.review_text)
    .filter((t) => t && typeof t === 'string')
  const summary = [venue?.compact_summary, venue?.review_summary, venue?.editorial_summary]
    .filter((s) => s && typeof s === 'string')
    .join(' ')
  const combined = [...reviewTexts, summary].filter(Boolean).join(' ')
  const themes = deriveCrowdSentiment(combined)

  if (!themes.length) return null

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Crowd Sentiment</Text>
        <View style={styles.titleRule} />
      </View>
      <View style={styles.chips}>
        {themes.map((theme, i) => (
          <View key={i} style={styles.chip}>
            <Text style={styles.chipText}>{theme.toUpperCase()}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: spacing.xl, paddingVertical: spacing.xl },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
  title: {
    fontSize: 14,
    fontFamily: fontFamilies.interBold,
    letterSpacing: 1.4,
    color: colors.textPrimary,
    textTransform: 'uppercase',
    marginRight: spacing.sm,
  },
  titleRule: { flex: 1, height: 1, backgroundColor: colors.borderLight },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderWidth: 2,
    borderColor: colors.borderInput,
    backgroundColor: colors.backgroundElevated,
  },
  chipText: {
    fontSize: 12,
    fontFamily: fontFamilies.interMedium,
    letterSpacing: 0.6,
    color: '#3f3f47',
  },
})
