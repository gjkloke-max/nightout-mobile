import { View, Text, Pressable, StyleSheet, Linking } from 'react-native'
import { Bookmark, Globe, ListPlus, MessageSquare, Send } from 'lucide-react-native'
import { colors, fontSizes, fontFamilies, spacing, iconSizes } from '../../theme'
import { cleanUrl, formatFullAddress } from '../../utils/venueProfileUtils'

export default function VenueActionBar({
  venue,
  user,
  onAddToList,
  onReview,
  onToggleFavorite,
  isFavorited,
  togglingFavorite,
  hasUserReview,
}) {
  const fullAddress = formatFullAddress(venue)
  const website = venue?.website ? cleanUrl(venue.website) : null

  const openWebsite = () => {
    if (website) Linking.openURL(website)
  }

  const openMaps = () => {
    if (fullAddress) {
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`)
    }
  }

  return (
    <View style={styles.container}>
      {user?.id ? (
        <View style={styles.actions}>
          <Pressable
            style={styles.btnSave}
            onPress={() => onToggleFavorite?.(venue?.venue_id)}
            disabled={togglingFavorite === venue?.venue_id}
          >
            <Bookmark size={iconSizes.xs} color="#fff" fill={isFavorited ? '#fff' : 'transparent'} strokeWidth={2} style={styles.btnIcon} />
            <Text style={styles.btnSaveText}>{isFavorited ? 'Saved' : 'Save'}</Text>
          </Pressable>
          <Pressable style={styles.btnSecondary} onPress={() => onAddToList?.({ id: venue?.venue_id, name: venue?.name })}>
            <ListPlus size={iconSizes.xs} color={colors.textPrimary} strokeWidth={2} style={styles.btnIcon} />
            <Text style={styles.btnSecondaryText}>Add to List</Text>
          </Pressable>
          <Pressable style={styles.btnSecondary} onPress={() => onReview?.()}>
            <MessageSquare size={iconSizes.xs} color={colors.textPrimary} strokeWidth={2} style={styles.btnIcon} />
            <Text style={styles.btnSecondaryText}>{hasUserReview ? 'Your review' : 'Review'}</Text>
          </Pressable>
        </View>
      ) : null}
      {fullAddress ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location</Text>
          <View style={styles.sectionRow}>
            <Text style={styles.address}>{fullAddress}</Text>
            <Pressable onPress={openMaps} hitSlop={8}>
              <Send size={iconSizes.inline} color={colors.textMuted} strokeWidth={2} />
            </Pressable>
          </View>
        </View>
      ) : null}
      {website ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Website</Text>
          <View style={styles.sectionRow}>
            <Pressable onPress={openWebsite}>
              <Text style={styles.link}>Visit Website</Text>
            </Pressable>
            <Text style={styles.icon}>🌐</Text>
          </View>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: spacing.base, paddingVertical: spacing.lg },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  btnSave: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: 12,
    backgroundColor: colors.textPrimary,
  },
  btnSaveText: { fontSize: fontSizes.sm, fontFamily: fontFamilies.interMedium, color: '#fff' },
  btnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: 12,
    backgroundColor: colors.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnSecondaryText: { fontSize: fontSizes.sm, fontFamily: fontFamilies.interMedium, color: colors.textPrimary },
  section: { marginBottom: spacing.md },
  sectionTitle: { fontSize: fontSizes.base, fontFamily: fontFamilies.frauncesSemiBold, color: colors.textPrimary, marginBottom: spacing.xs },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  address: { flex: 1, fontSize: fontSizes.sm, fontFamily: fontFamilies.inter, color: colors.textMuted },
  link: { fontSize: fontSizes.sm, fontFamily: fontFamilies.interMedium, color: colors.link, textDecorationLine: 'underline' },
})
