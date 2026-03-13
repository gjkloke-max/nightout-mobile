import { View, Text, StyleSheet } from 'react-native'
import { colors, fontSizes, spacing } from '../../theme'
import { truncateToWords } from '../../utils/venueProfileUtils'

export default function VenueEditorialSummary({ venue }) {
  const source =
    venue?.compact_summary ||
    venue?.review_summary ||
    venue?.editorial_summary ||
    ''
  const summary = truncateToWords(source, 40)
  if (!summary) return null

  return (
    <View style={styles.container}>
      <Text style={styles.text}>{summary}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: spacing.base, paddingVertical: spacing.sm },
  text: { fontSize: fontSizes.sm, color: colors.textSecondary, lineHeight: 22 },
})
