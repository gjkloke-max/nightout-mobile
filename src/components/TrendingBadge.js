import { Text, StyleSheet } from 'react-native'

export default function TrendingBadge({ style }) {
  return (
    <Text style={[styles.badge, style]} accessibilityLabel="Trending">
      TRENDING
    </Text>
  )
}

const styles = StyleSheet.create({
  badge: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#9d174d',
    backgroundColor: '#fdf2f8',
    color: '#9d174d',
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.5,
    overflow: 'hidden',
  },
})
