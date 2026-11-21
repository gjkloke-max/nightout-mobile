/**
 * Asks people to update when a newer build is recommended, and stops the app when this build is
 * older than the minimum we support.
 *
 * It wraps the whole app. Until a check says otherwise the app renders as usual, so a slow or failed
 * check costs nothing. The check runs at launch and each time the app returns to the foreground,
 * so raising the minimum reaches people who keep the app open.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { checkForUpdate, dismissUpdate, openStore } from '../lib/appUpdate'
import { colors, fontFamilies, spacing } from '../theme'

/** Returning to the foreground re-checks, but not more often than this. */
const RECHECK_MS = 60 * 1000

const REQUIRED_TEXT = 'This version of Brio is no longer supported. Update to keep using the app.'
const AVAILABLE_TEXT = 'A newer version of Brio is ready, with fixes and improvements.'

export default function AppUpdateGate({ children }) {
  const insets = useSafeAreaInsets()
  const [update, setUpdate] = useState({ status: 'none', message: null, storeUrl: null, recommendedBuild: null })
  const [storeFailed, setStoreFailed] = useState(false)
  const lastCheck = useRef(0)
  const checking = useRef(false)

  const check = useCallback(async () => {
    if (checking.current || Date.now() - lastCheck.current < RECHECK_MS) return
    checking.current = true
    try {
      const next = await checkForUpdate()
      lastCheck.current = Date.now()
      setUpdate(next)
    } finally {
      checking.current = false
    }
  }, [])

  useEffect(() => {
    check()
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') check()
    })
    return () => sub.remove()
  }, [check])

  const goToStore = async () => {
    setStoreFailed(false)
    const opened = await openStore(update.storeUrl)
    if (!opened) setStoreFailed(true)
  }

  const notNow = () => {
    dismissUpdate(update.recommendedBuild)
    setUpdate((u) => ({ ...u, status: 'none' }))
  }

  if (update.status === 'required') {
    return (
      <View style={[styles.required, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl }]}>
        <View style={styles.requiredBody}>
          <Text style={styles.requiredTitle} accessibilityRole="header">
            Update required
          </Text>
          <Text style={styles.body}>{update.message || REQUIRED_TEXT}</Text>
          {storeFailed ? <Text style={styles.error}>Couldn’t open the store. Open it and search for Brio to update.</Text> : null}
        </View>
        <Pressable style={styles.primaryBtn} onPress={goToStore} accessibilityRole="button">
          <Text style={styles.primaryBtnText}>Update</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View style={styles.fill}>
      {children}
      <Modal visible={update.status === 'available'} transparent animationType="slide" onRequestClose={notNow}>
        <Pressable style={styles.backdrop} onPress={notNow} accessibilityLabel="Dismiss" />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.xl }]}>
          <Text style={styles.title} accessibilityRole="header">
            Update available
          </Text>
          <Text style={styles.body}>{update.message || AVAILABLE_TEXT}</Text>
          {storeFailed ? <Text style={styles.error}>Couldn’t open the store. Open it and search for Brio to update.</Text> : null}
          <Pressable style={styles.primaryBtn} onPress={goToStore} accessibilityRole="button">
            <Text style={styles.primaryBtnText}>Update</Text>
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={notNow} accessibilityRole="button">
            <Text style={styles.secondaryBtnText}>Not now</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  required: {
    flex: 1,
    backgroundColor: colors.backgroundCanvas,
    paddingHorizontal: spacing.xl,
    justifyContent: 'space-between',
  },
  requiredBody: { flex: 1, justifyContent: 'center' },
  requiredTitle: { fontSize: 32, lineHeight: 38, fontFamily: fontFamilies.frauncesRegular, color: colors.textPrimary, marginBottom: spacing.md },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: colors.backgroundElevated,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.xl,
  },
  title: { fontSize: 20, fontFamily: fontFamilies.frauncesRegular, color: colors.textPrimary, marginBottom: spacing.sm },
  body: { fontSize: 15, lineHeight: 22, fontFamily: fontFamilies.inter, color: colors.textSecondary },
  error: { color: colors.error, fontSize: 13, lineHeight: 18, fontFamily: fontFamilies.inter, marginTop: spacing.md },
  primaryBtn: {
    marginTop: spacing.lg,
    backgroundColor: colors.textPrimary,
    borderRadius: 12,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  primaryBtnText: { color: colors.backgroundElevated, fontSize: 15, fontFamily: fontFamilies.interMedium },
  secondaryBtn: { marginTop: spacing.sm, paddingVertical: spacing.md, alignItems: 'center' },
  secondaryBtnText: { color: colors.textSecondary, fontSize: 14, fontFamily: fontFamilies.inter },
})
