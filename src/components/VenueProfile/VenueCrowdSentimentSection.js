import { View, Text, StyleSheet } from 'react-native'
import { colors, fontSizes, fontFamilies, spacing } from '../../theme'
import { deriveCrowdSentiment } from '../../utils/venueProfileUtils'

export default function VenueCrowdSentimentSection({ venue, reviews = [] }) {
  const reviewTexts = (reviews || [])
    .map((r) => r?.review_text)
    .filter((t) => t && typeof t === 'string')
  const summary = venue?.review_summary || venue?.editorial_summary || ''
  const combined = [...reviewTexts, summary].filter(Boolean).join(' ')
  const themes = deriveCrowdSentiment(combined)

  if (!themes.length) return null

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Crowd Sentiment</Text>
      <View style={styles.chips}>
        {themes.map((theme, i) => (
          <View key={i} style={styles.chip}>
            <Text style={styles.chipText}>{theme}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: spacing.base, paddingVertical: spacing.lg },
  title: {
    fontSize: fontSizes.base,
    fontFamily: fontFamilies.frauncesSemiBold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.xs,
    borderRadius: 12,
    backgroundColor: colors.surfaceLight,
  },
  chipText: { fontSize: fontSizes.sm, fontFamily: fontFamilies.interMedium, color: colors.textPrimary },
})
