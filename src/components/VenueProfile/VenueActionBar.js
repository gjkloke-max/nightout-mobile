import { View, Text, Pressable, StyleSheet, Linking } from 'react-native'
import { colors, fontSizes, spacing } from '../../theme'
import { cleanUrl, formatFullAddress } from '../../utils/venueProfileUtils'

export default function VenueActionBar({
  venue,
  user,
  onAddToList,
  onReview,
  hasUserReview,
}) {
  const fullAddress = formatFullAddress(venue)
  const website = venue?.website ? cleanUrl(venue.website) : null

  const openWebsite = () => {
    if (website) Linking.openURL(website)
  }

  return (
    <View style={styles.container}>
      <View style={styles.actions}>
        {user?.id ? (
          <>
            <Pressable style={styles.btn} onPress={() => onAddToList?.({ id: venue?.venue_id, name: venue?.name })}>
              <Text style={styles.btnText}>Add to list</Text>
            </Pressable>
            <Pressable style={styles.btn} onPress={() => onReview?.()}>
              <Text style={styles.btnText}>{hasUserReview ? 'Your review' : 'Review this place'}</Text>
            </Pressable>
          </>
        ) : null}
      </View>
      <View style={styles.info}>
        {website ? (
          <Pressable onPress={openWebsite}>
            <Text style={styles.link}>Website</Text>
          </Pressable>
        ) : null}
        {fullAddress ? <Text style={styles.address}>{fullAddress}</Text> : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: spacing.base, paddingVertical: spacing.lg },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  btn: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnText: { fontSize: fontSizes.sm, color: colors.textPrimary, fontWeight: '500' },
  info: { gap: spacing.xs },
  link: { fontSize: fontSizes.sm, color: colors.link },
  address: { fontSize: fontSizes.sm, color: colors.textMuted },
})
