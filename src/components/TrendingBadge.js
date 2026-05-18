import { View, StyleSheet } from 'react-native'
import { Flame } from 'lucide-react-native'

const ICON_SIZE = 14
const TRENDING_COLOR = '#e11d48'

/** Flame icon for venues in the top-200 trending pool. */
export default function TrendingBadge({ style, size = ICON_SIZE }) {
  return (
    <View
      style={[styles.wrap, style]}
      accessibilityRole="image"
      accessibilityLabel="Trending on Brio"
    >
      <Flame size={size} color={TRENDING_COLOR} fill={TRENDING_COLOR} strokeWidth={2} />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    marginLeft: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
})
