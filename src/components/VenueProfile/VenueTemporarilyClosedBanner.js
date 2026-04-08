import { View, Text, StyleSheet } from 'react-native'
import { AlertCircle } from 'lucide-react-native'
import { colors, fontFamilies, fontSizes, spacing } from '../../theme'

export default function VenueTemporarilyClosedBanner() {
  return (
    <View style={styles.banner} accessibilityRole="text" accessibilityLabel="Temporarily closed">
      <AlertCircle size={20} color="#fff" strokeWidth={2} />
      <View style={styles.textCol}>
        <Text style={styles.kicker}>TEMPORARILY CLOSED</Text>
        <Text style={styles.sub}>This venue is currently closed. Check back soon for updates.</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 66,
    paddingVertical: 16,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.browseAccent,
  },
  textCol: { flex: 1, gap: 2 },
  kicker: {
    fontSize: 12,
    fontFamily: fontFamilies.interBold,
    letterSpacing: 1.2,
    color: '#fff',
  },
  sub: {
    fontSize: 12,
    fontFamily: fontFamilies.inter,
    lineHeight: 16,
    color: 'rgba(255,255,255,0.9)',
  },
})
