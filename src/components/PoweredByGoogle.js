import { View, Text, StyleSheet } from 'react-native'
import { colors, fontFamilies } from '../theme'

/**
 * "Powered by Google" attribution.
 *
 * Google's Places API policies require this wherever Places-derived content is shown outside a
 * Google Map — a map renders its own attribution, everything else has to carry this. In Brio that
 * means two places: the venue reviews imported from Google, and the address autocomplete
 * predictions.
 *
 * Kept as one component so the wording stays identical everywhere, which is what the policy asks
 * for, and so a future surface that starts showing Places data has something obvious to reuse.
 *
 * @param {{ style?: object }} props
 */
export default function PoweredByGoogle({ style }) {
  return (
    <View style={[styles.wrap, style]}>
      <Text style={styles.text}>Powered by Google</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: 6,
    alignItems: 'flex-end',
  },
  text: {
    fontSize: 11,
    fontFamily: fontFamilies.inter,
    color: colors.textMuted,
  },
})
