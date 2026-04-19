import { useState, useEffect, useRef } from 'react'
import {
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { authColors, authFonts, authSpacing } from '../../theme/authTheme'
import { onboardingScrollContentBase, onboardingHeaderStyles } from '../../theme/onboardingLayout'
import OnboardingBackRow from '../../components/onboarding/OnboardingBackRow'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { ONBOARDING_STEP } from '../../services/profileOnboarding'
import {
  formatUsPhoneDisplayFromDigits,
  normalizeUsPhoneDigits,
  phoneDigitsForStorage,
} from '../../utils/phoneFormat'

function validEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((s || '').trim())
}

export default function GetStartedScreen({ navigation }) {
  const insets = useSafeAreaInsets()
  const { signUp, refreshProfile, profile, signOut } = useAuth()
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const hydratedRef = useRef(false)

  useEffect(() => {
    if (!profile?.id || hydratedRef.current) return
    if (profile.email) setEmail(profile.email)
    if (profile.phone_number) setPhone(formatUsPhoneDisplayFromDigits(String(profile.phone_number)))
    hydratedRef.current = true
  }, [profile?.id, profile?.email, profile?.phone_number])

  const onPhoneChange = (text) => {
    const d = normalizeUsPhoneDigits(text)
    setPhone(formatUsPhoneDisplayFromDigits(d))
  }

  const onContinue = async () => {
    setErr('')
    if (!validEmail(email)) {
      setErr('Enter a valid email address.')
      return
    }
    const digits = phoneDigitsForStorage(phone)
    if (digits.length !== 10) {
      setErr('Enter a valid 10-digit US phone number.')
      return
    }
    if (password.length < 8) {
      setErr('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setErr('Passwords do not match.')
      return
    }
    setLoading(true)
    try {
      const { data, error } = await signUp(email.trim(), password)
      if (error) {
        if (/already registered|already been registered/i.test(error.message)) {
          setErr('An account with this email already exists. Sign in instead.')
        } else {
          setErr(error.message || 'Sign up failed')
        }
        return
      }
      const u = data?.user
      if (!u?.id) {
        setErr('Could not create your account. Try again.')
        return
      }
      if (!data?.session) {
        setErr('Check your email to verify your account, then sign in.')
        return
      }
      if (!supabase) return
      const { error: pe } = await supabase.from('profiles').upsert(
        {
          id: u.id,
          email: email.trim(),
          phone_number: digits,
          auth_provider: 'email',
          onboarding_completed: false,
          onboarding_step: ONBOARDING_STEP.ABOUT_YOU,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )
      if (pe) {
        setErr(pe.message)
        return
      }
      await refreshProfile()
    } finally {
      setLoading(false)
    }
  }

  const onBack = async () => {
    if (navigation.canGoBack()) {
      const state = navigation.getState()
      const idx = state.index
      const prev = idx > 0 ? state.routes[idx - 1] : null
      // About You → Get Started puts AboutYou under us; going "back" should leave signup toward the start screen (Landing), not ping-pong to About You.
      if (prev?.name === 'AboutYou') {
        await signOut()
        return
      }
      navigation.goBack()
      return
    }
    const routeNames = navigation.getState()?.routeNames ?? []
    if (routeNames.includes('Landing')) {
      navigation.navigate('Landing')
      return
    }
    await signOut()
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.contentGrow, onboardingScrollContentBase(insets, 0)]}
        keyboardShouldPersistTaps="handled"
      >
        <OnboardingBackRow onPress={onBack} />

        <Text style={onboardingHeaderStyles.title}>Get Started</Text>
        <Text style={onboardingHeaderStyles.sub}>We'll need a few details to set up your account</Text>

        {err ? <Text style={styles.error}>{err}</Text> : null}

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor={authColors.textMuted}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={styles.label}>Cell phone</Text>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={onPhoneChange}
          placeholder="763-439-2450"
          placeholderTextColor={authColors.textMuted}
          keyboardType="phone-pad"
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="Create a password"
          placeholderTextColor={authColors.textMuted}
          secureTextEntry
        />

        <Text style={styles.label}>Confirm password</Text>
        <TextInput
          style={styles.input}
          value={confirm}
          onChangeText={setConfirm}
          placeholder="Confirm your password"
          placeholderTextColor={authColors.textMuted}
          secureTextEntry
        />

        <Pressable
          style={[styles.continue, loading && styles.disabled]}
          onPress={onContinue}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={authColors.onAccent} />
          ) : (
            <Text style={styles.continueText}>Continue</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: authColors.canvas },
  contentGrow: { flexGrow: 1 },
  label: { fontFamily: authFonts.interMedium, fontSize: 14, color: authColors.textPrimary, marginBottom: authSpacing.xs },
  input: {
    borderWidth: 1,
    borderColor: authColors.border,
    paddingHorizontal: authSpacing.md,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: authFonts.inter,
    color: authColors.inputText,
    marginBottom: authSpacing.md,
    backgroundColor: authColors.surface,
  },
  error: { fontFamily: authFonts.inter, fontSize: 14, color: authColors.error, marginBottom: authSpacing.md },
  continue: {
    marginTop: authSpacing.md,
    backgroundColor: authColors.accent,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueText: { fontFamily: authFonts.interMedium, fontSize: 16, color: authColors.onAccent },
  disabled: { opacity: 0.7 },
})
