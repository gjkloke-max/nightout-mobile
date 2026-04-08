import { View, Text, Pressable, StyleSheet, Linking } from 'react-native'
import { Bookmark, ListPlus, MessageCircle, Send, Navigation, Globe } from 'lucide-react-native'
import { colors, fontSizes, fontFamilies, spacing, iconSizes } from '../../theme'
import { cleanUrl, formatFullAddress } from '../../utils/venueProfileUtils'

export default function VenueActionBar({
  venue,
  user,
  onAddToList,
  onReview,
  onSendVenue,
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
        <>
          <View style={styles.primaryRow}>
            <Pressable
              style={styles.btnSave}
              onPress={() => onToggleFavorite?.(venue?.venue_id)}
              disabled={togglingFavorite === venue?.venue_id}
            >
              <Bookmark
                size={iconSizes.xs}
                color="#fff"
                fill={isFavorited ? '#fff' : 'transparent'}
                strokeWidth={2}
              />
              <Text style={styles.btnSaveText}>{isFavorited ? 'Saved' : 'Save'}</Text>
            </Pressable>
            <Pressable style={styles.btnList} onPress={() => onAddToList?.({ id: venue?.venue_id, name: venue?.name })}>
              <ListPlus size={iconSizes.xs} color={colors.textPrimary} strokeWidth={2} />
              <Text style={styles.btnListText}>List</Text>
            </Pressable>
          </View>
          <View style={styles.secondaryRow}>
            <Pressable style={styles.btnMuted} onPress={() => onReview?.()}>
              <MessageCircle size={iconSizes.xs} color={colors.textPrimary} strokeWidth={2} />
              <Text style={styles.btnMutedText}>{hasUserReview ? 'Your review' : 'Review'}</Text>
            </Pressable>
            <Pressable style={styles.btnMuted} onPress={() => onSendVenue?.()}>
              <Send size={iconSizes.xs} color={colors.textPrimary} strokeWidth={2} />
              <Text style={styles.btnMutedText}>Send</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <Text style={styles.hint}>Sign in to save venues, add to lists, review, and send to friends.</Text>
      )}

      {(fullAddress || website) && (
        <View style={styles.infoPanel}>
          {fullAddress ? (
            <View style={styles.infoBlock}>
              <Text style={styles.infoLabel}>Location</Text>
              <View style={styles.infoRow}>
                <Text style={styles.infoValue}>{fullAddress}</Text>
                <Pressable style={styles.roundBtn} onPress={openMaps} hitSlop={8} accessibilityLabel="Open in maps">
                  <Navigation size={18} color={colors.textSecondary} strokeWidth={2} />
                </Pressable>
              </View>
            </View>
          ) : null}
          {fullAddress && website ? <View style={styles.divider} /> : null}
          {website ? (
            <View style={styles.infoBlock}>
              <Text style={styles.infoLabel}>Website</Text>
              <View style={styles.infoRow}>
                <Pressable onPress={openWebsite} style={styles.websitePress}>
                  <Text style={styles.websiteLink}>Visit Official Site</Text>
                </Pressable>
                <Pressable style={styles.roundBtn} onPress={openWebsite} hitSlop={8} accessibilityLabel="Open website">
                  <Globe size={18} color={colors.textSecondary} strokeWidth={2} />
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: spacing.xl },
  primaryRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  secondaryRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  btnSave: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 45,
    backgroundColor: colors.backgroundDark,
  },
  btnSaveText: {
    fontSize: 12,
    fontFamily: fontFamilies.interBold,
    letterSpacing: 1.2,
    color: '#fff',
  },
  btnList: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 45,
    backgroundColor: colors.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.backgroundDark,
  },
  btnListText: {
    fontSize: 12,
    fontFamily: fontFamilies.interBold,
    letterSpacing: 1.2,
    color: colors.textPrimary,
  },
  btnMuted: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 45,
    backgroundColor: colors.surface,
  },
  btnMutedText: {
    fontSize: 12,
    fontFamily: fontFamilies.interBold,
    letterSpacing: 1.2,
    color: colors.textPrimary,
  },
  hint: {
    fontSize: fontSizes.sm,
    fontFamily: fontFamilies.inter,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  infoPanel: {
    backgroundColor: '#fdfbf7',
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderColor: colors.borderLight,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    marginHorizontal: -spacing.xl,
    marginBottom: spacing.sm,
  },
  infoBlock: { marginBottom: 0 },
  infoLabel: {
    fontSize: 10,
    fontFamily: fontFamilies.interBold,
    letterSpacing: 1,
    color: colors.textTag,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md },
  infoValue: {
    flex: 1,
    fontSize: fontSizes.base,
    fontFamily: fontFamilies.interMedium,
    color: colors.textPrimary,
    lineHeight: 24,
  },
  websitePress: { flex: 1 },
  websiteLink: {
    fontSize: fontSizes.base,
    fontFamily: fontFamilies.interMedium,
    color: colors.browseAccent,
    textDecorationLine: 'underline',
  },
  roundBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.backgroundElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: { height: 1, backgroundColor: colors.borderLight, marginVertical: spacing.lg },
})
