import {
  Modal,
  View,
  Text,
  Pressable,
  Image,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, fontFamilies, fontSizes, spacing, borderRadius } from '../theme'

const { width: W } = Dimensions.get('window')
const IMG_MAX = Math.min(W * 0.92, 420)

/**
 * Full-screen style viewer for a profile avatar. Optional edit actions for the current user only.
 */
export default function ProfilePhotoViewerModal({
  visible,
  onClose,
  avatarUrl,
  initialLetter = '?',
  showEditActions = false,
  onChangePhoto,
  onRemovePhoto,
  busy = false,
}) {
  const insets = useSafeAreaInsets()
  const hasPhoto = !!(avatarUrl && String(avatarUrl).trim())

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.topBar}>
          <Pressable
            onPress={onClose}
            style={styles.closeBtn}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Text style={styles.closeText}>×</Text>
          </Pressable>
        </View>

        <Pressable style={styles.centerArea} onPress={onClose}>
          <Pressable style={styles.imageShell} onPress={(e) => e.stopPropagation()}>
            {hasPhoto ? (
              <Image
                source={{ uri: avatarUrl }}
                style={styles.image}
                resizeMode="contain"
              />
            ) : (
              <View style={styles.placeholderLarge}>
                <Text style={styles.placeholderLetter}>{(initialLetter || '?').charAt(0).toUpperCase()}</Text>
              </View>
            )}
          </Pressable>
        </Pressable>

        {showEditActions ? (
          <View style={styles.actions}>
            <Pressable
              style={[styles.primaryBtn, busy && styles.btnDisabled]}
              onPress={() => !busy && onChangePhoto?.()}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={hasPhoto ? 'Change profile photo' : 'Add profile photo'}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>{hasPhoto ? 'Change photo' : 'Add photo'}</Text>
              )}
            </Pressable>
            {hasPhoto && onRemovePhoto ? (
              <Pressable
                style={[styles.secondaryBtn, busy && styles.btnDisabled]}
                onPress={() => !busy && onRemovePhoto()}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Remove profile photo"
              >
                <Text style={styles.secondaryBtnText}>Remove photo</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.94)',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm,
  },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: '#fff',
    fontSize: 32,
    lineHeight: 36,
  },
  centerArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
  },
  imageShell: {
    maxWidth: IMG_MAX,
    maxHeight: IMG_MAX,
    width: IMG_MAX,
    height: IMG_MAX,
    borderRadius: IMG_MAX / 2,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholderLarge: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  placeholderLetter: {
    fontSize: 120,
    fontFamily: fontFamilies.fraunces,
    color: colors.textMuted,
  },
  actions: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  primaryBtn: {
    backgroundColor: colors.profileAccent,
    paddingVertical: 14,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  primaryBtnText: {
    fontSize: fontSizes.sm,
    fontFamily: fontFamilies.interBold,
    color: '#fff',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  secondaryBtn: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontSize: fontSizes.sm,
    fontFamily: fontFamilies.interMedium,
    color: 'rgba(255,255,255,0.75)',
  },
  btnDisabled: { opacity: 0.55 },
})
