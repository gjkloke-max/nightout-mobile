import { useState } from 'react'
import {
  View,
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
import { useAuth } from '../../contexts/AuthContext'

export default function SignInScreen({ navigation }) {
  const insets = useSafeAreaInsets()
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  const onSubmit = async () => {
    setErr('')
    if (!email.trim() || !password) {
      setErr('Enter email and password.')
      return
    }
    setLoading(true)
    try {
      const { error } = await signIn(email.trim(), password)
      if (error) {
        setErr(error.message === 'Invalid login credentials' ? 'Invalid email or password.' : error.message)
        return
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + authSpacing.md, paddingBottom: insets.bottom + authSpacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Text style={styles.back}>Back</Text>
        </Pressable>

        <Text style={styles.title}>Sign In</Text>
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

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          placeholderTextColor={authColors.textMuted}
          secureTextEntry
        />

        <Pressable onPress={() => navigation.navigate('ForgotPassword')}>
          <Text style={styles.link}>Forgot password?</Text>
        </Pressable>

        <Pressable style={[styles.btn, loading && styles.disabled]} onPress={onSubmit} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={authColors.onAccent} />
          ) : (
            <Text style={styles.btnText}>Sign In</Text>
          )}
        </Pressable>

        <Pressable style={styles.footer} onPress={() => navigation.navigate('GetStarted')}>
          <Text style={styles.footerText}>Don't have an account? Create one</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: authColors.canvas },
  content: { paddingHorizontal: authSpacing.lg, maxWidth: 520, width: '100%', alignSelf: 'center' },
  back: { fontFamily: authFonts.interMedium, fontSize: 14, color: authColors.textPrimary, marginBottom: authSpacing.lg },
  title: { fontFamily: authFonts.fraunces, fontSize: 40, color: authColors.textPrimary, marginBottom: authSpacing.xl },
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
  link: {
    fontFamily: authFonts.interMedium,
    fontSize: 14,
    color: authColors.accent,
    marginBottom: authSpacing.lg,
  },
  error: { fontFamily: authFonts.inter, fontSize: 14, color: authColors.error, marginBottom: authSpacing.md },
  btn: {
    backgroundColor: authColors.accent,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontFamily: authFonts.interMedium, fontSize: 16, color: authColors.onAccent },
  footer: { marginTop: authSpacing.xl, alignItems: 'center' },
  footerText: { fontFamily: authFonts.interMedium, fontSize: 14, color: authColors.textSecondary },
  disabled: { opacity: 0.7 },
})
