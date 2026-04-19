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
import * as Linking from 'expo-linking'
import { authColors, authFonts, authSpacing } from '../../theme/authTheme'
import { supabase } from '../../lib/supabase'

export default function ForgotPasswordScreen({ navigation }) {
  const insets = useSafeAreaInsets()
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  const onSend = async () => {
    setErr('')
    setMsg('')
    const e = email.trim()
    if (!e) {
      setErr('Enter your email.')
      return
    }
    if (!supabase) {
      setErr('App not configured.')
      return
    }
    setLoading(true)
    try {
      const redirectTo = Linking.createURL('auth/recovery')
      const { error } = await supabase.auth.resetPasswordForEmail(e, { redirectTo })
      if (error) {
        setErr(error.message)
        return
      }
      setMsg('Check your email for reset instructions.')
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

        <Text style={styles.title}>Reset Password</Text>
        <Text style={styles.sub}>We'll email you a link to reset your password.</Text>

        {err ? <Text style={styles.error}>{err}</Text> : null}
        {msg ? <Text style={styles.success}>{msg}</Text> : null}

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

        <Pressable style={[styles.btn, loading && styles.disabled]} onPress={onSend} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={authColors.onAccent} />
          ) : (
            <Text style={styles.btnText}>Send Reset Instructions</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: authColors.canvas },
  content: { paddingHorizontal: authSpacing.lg, maxWidth: 520, width: '100%', alignSelf: 'center' },
  back: { fontFamily: authFonts.interMedium, fontSize: 14, color: authColors.textPrimary, marginBottom: authSpacing.lg },
  title: { fontFamily: authFonts.fraunces, fontSize: 40, color: authColors.textPrimary, marginBottom: authSpacing.sm },
  sub: { fontFamily: authFonts.inter, fontSize: 16, color: authColors.textSecondary, marginBottom: authSpacing.xl },
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
  success: { fontFamily: authFonts.inter, fontSize: 14, color: authColors.textSecondary, marginBottom: authSpacing.md },
  btn: {
    marginTop: authSpacing.md,
    backgroundColor: authColors.accent,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontFamily: authFonts.interMedium, fontSize: 16, color: authColors.onAccent },
  disabled: { opacity: 0.7 },
})
