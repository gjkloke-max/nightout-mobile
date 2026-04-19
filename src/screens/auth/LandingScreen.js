import { View, Text, StyleSheet, Pressable, ActivityIndicator, Linking, Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useState } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { authColors, authFonts, authSpacing } from '../../theme/authTheme'
import { useAuth } from '../../contexts/AuthContext'
import { config } from '../../lib/config'

export default function LandingScreen({ navigation }) {
  const insets = useSafeAreaInsets()
  const { googleSignIn, appleSignIn } = useAuth()
  const [busy, setBusy] = useState(null)

  const openLegal = (path) => {
    const base = (config.webAppUrl || '').replace(/\/$/, '')
    if (!base) return
    Linking.openURL(`${base}${path}`)
  }

  const onGoogle = async () => {
    setBusy('google')
    const { error } = await googleSignIn()
    setBusy(null)
    if (error?.message && error.message !== 'cancelled') {
      /* handled by auth state */
    }
  }

  const onApple = async () => {
    if (Platform.OS !== 'ios') return
    setBusy('apple')
    const { error } = await appleSignIn()
    setBusy(null)
    if (error?.message && error.message !== 'cancelled') {
      /* optional toast */
    }
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom + authSpacing.md }]}>
      <View style={styles.hero}>
        <Text style={styles.logo}>Brio</Text>
        <Text style={styles.tagline}>the future of city discovery</Text>
      </View>

      <View style={styles.actions}>
        {Platform.OS === 'ios' ? (
          <Pressable
            style={({ pressed }) => [styles.btnApple, pressed && styles.pressed]}
            onPress={onApple}
            disabled={busy !== null}
          >
            {busy === 'apple' ? (
              <ActivityIndicator color={authColors.onApple} />
            ) : (
              <View style={styles.btnRow}>
                <Ionicons name="logo-apple" size={22} color={authColors.onApple} style={styles.btnIcon} />
                <Text style={styles.btnAppleText}>Continue with Apple</Text>
              </View>
            )}
          </Pressable>
        ) : null}

        <Pressable
          style={({ pressed }) => [styles.btnGoogle, pressed && styles.pressed]}
          onPress={onGoogle}
          disabled={busy !== null}
        >
          {busy === 'google' ? (
            <ActivityIndicator color={authColors.textPrimary} />
          ) : (
            <View style={styles.btnRow}>
              <Ionicons name="logo-google" size={20} color="#4285F4" style={styles.btnIcon} />
              <Text style={styles.btnGoogleText}>Continue with Google</Text>
            </View>
          )}
        </Pressable>

        <View style={styles.orRow}>
          <View style={styles.orLine} />
          <Text style={styles.orText}>or</Text>
          <View style={styles.orLine} />
        </View>

        <Pressable
          style={({ pressed }) => [styles.btnCreate, pressed && styles.pressed]}
          onPress={() => navigation.navigate('GetStarted')}
          disabled={busy !== null}
        >
          <Text style={styles.btnCreateText}>Create Account</Text>
        </Pressable>

        <Pressable style={styles.linkWrap} onPress={() => navigation.navigate('SignIn')} disabled={busy !== null}>
          <Text style={styles.linkText}>Already have an account? Sign in</Text>
        </Pressable>
      </View>

      <View style={styles.legalRow}>
        <Pressable onPress={() => openLegal('/terms')} disabled={!config.webAppUrl}>
          <Text style={styles.legal}>Terms of Service</Text>
        </Pressable>
        <Text style={styles.legalDot}>·</Text>
        <Pressable onPress={() => openLegal('/privacy')} disabled={!config.webAppUrl}>
          <Text style={styles.legal}>Privacy Policy</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: authColors.canvas,
    paddingHorizontal: authSpacing.lg,
    justifyContent: 'space-between',
  },
  hero: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: authSpacing.xxl,
  },
  logo: {
    fontFamily: authFonts.fraunces,
    fontSize: 48,
    color: authColors.textPrimary,
    marginBottom: authSpacing.sm,
  },
  tagline: {
    fontFamily: authFonts.inter,
    fontSize: 16,
    color: authColors.textSecondary,
    textAlign: 'center',
  },
  actions: {
    gap: authSpacing.md,
    width: '100%',
    maxWidth: 448,
    alignSelf: 'center',
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnIcon: { marginRight: 10 },
  btnApple: {
    backgroundColor: authColors.appleButton,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  btnAppleText: {
    fontFamily: authFonts.interMedium,
    fontSize: 16,
    color: authColors.onApple,
  },
  btnGoogle: {
    backgroundColor: authColors.surface,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: authColors.border,
    width: '100%',
  },
  btnGoogleText: {
    fontFamily: authFonts.interMedium,
    fontSize: 16,
    color: authColors.textPrimary,
  },
  btnCreate: {
    backgroundColor: authColors.accent,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  btnCreateText: {
    fontFamily: authFonts.interMedium,
    fontSize: 16,
    color: authColors.onAccent,
  },
  pressed: { opacity: 0.88 },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: authSpacing.md, marginVertical: authSpacing.xs },
  orLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: authColors.border },
  orText: { fontFamily: authFonts.inter, fontSize: 14, color: authColors.textSecondary },
  linkWrap: { alignItems: 'center', paddingVertical: authSpacing.sm },
  linkText: { fontFamily: authFonts.interMedium, fontSize: 14, color: authColors.textPrimary },
  legalRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: authSpacing.sm },
  legal: { fontFamily: authFonts.interMedium, fontSize: 14, color: authColors.textMuted },
  legalDot: { fontFamily: authFonts.inter, fontSize: 12, color: authColors.textMuted },
})
