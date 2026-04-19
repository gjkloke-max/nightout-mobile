import { useState, useEffect, useRef } from 'react'
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
import { supabase } from '../../lib/supabase'
import { checkUsernameAvailable } from '../../services/profileUsername'
import { validateUsernameFormat } from '../../utils/mentions'
import { applyDerivedHomeFromAddress } from '../../services/addressNeighborhood'
import { updateOnboardingStep, ONBOARDING_STEP } from '../../services/profileOnboarding'
import {
  fetchAddressPredictions,
  fetchPlaceDetails,
  hasGooglePlacesKey,
} from '../../services/placesAutocomplete'
import AddressAutocompleteField from '../../components/AddressAutocompleteField'

const PRED_DEBOUNCE_MS = 400

export default function AboutYouScreen({ navigation }) {
  const insets = useSafeAreaInsets()
  const { user, profile, refreshProfile } = useAuth()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [username, setUsername] = useState('')
  const [address, setAddress] = useState('')
  const [pickedPlace, setPickedPlace] = useState(null)
  const [predictions, setPredictions] = useState([])
  const [predLoading, setPredLoading] = useState(false)
  const [usernameError, setUsernameError] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef(null)

  useEffect(() => {
    if (!profile) return
    setFirstName(profile.first_name || '')
    setLastName(profile.last_name || '')
    setUsername(profile.username || '')
    const addr = profile.home_address || ''
    setAddress(addr)
    setPickedPlace(null)
    setPredictions([])
  }, [profile?.id, profile?.first_name, profile?.last_name, profile?.username, profile?.home_address])

  useEffect(() => {
    if (pickedPlace && address.trim() !== pickedPlace.description) {
      setPickedPlace(null)
    }
  }, [address, pickedPlace])

  useEffect(() => {
    if (!hasGooglePlacesKey()) {
      setPredictions([])
      return
    }
    const q = address.trim()
    if (q.length < 3 || pickedPlace) {
      setPredictions([])
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setPredLoading(true)
      try {
        const list = await fetchAddressPredictions(q)
        setPredictions(list)
      } finally {
        setPredLoading(false)
      }
    }, PRED_DEBOUNCE_MS)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [address, pickedPlace])

  const onAddressChange = (t) => {
    setAddress(t)
    setErr('')
  }

  const onPickPrediction = (p) => {
    setPickedPlace({ placeId: p.placeId, description: p.description })
    setAddress(p.description)
    setPredictions([])
    setErr('')
  }

  const onContinue = async () => {
    if (!user?.id) return
    setErr('')
    setUsernameError('')
    const v = validateUsernameFormat(username)
    if (!v.ok) {
      setUsernameError(v.error || 'Invalid username')
      return
    }
    if (v.normalized && v.normalized !== (profile?.username || '').toLowerCase()) {
      const avail = await checkUsernameAvailable(v.normalized, user.id)
      if (!avail.available) {
        setUsernameError(avail.error || 'Username unavailable')
        return
      }
    }
    if (!firstName.trim() || !lastName.trim()) {
      setErr('Please enter your first and last name.')
      return
    }
    const trimmedAddr = address.trim()
    if (!trimmedAddr) {
      setErr('Please enter your home address.')
      return
    }

    let formattedAddr = trimmedAddr
    let precoded = null

    if (hasGooglePlacesKey()) {
      if (!pickedPlace?.placeId) {
        setErr('Choose an address from the suggestions.')
        return
      }
      setLoading(true)
      try {
        const details = await fetchPlaceDetails(pickedPlace.placeId)
        if (!details) {
          setErr('Could not load that address. Try another suggestion.')
          return
        }
        formattedAddr = details.formattedAddress || trimmedAddr
        precoded = { lat: details.lat, lng: details.lng }
      } finally {
        setLoading(false)
      }
    }

    setLoading(true)
    try {
      const { error: upErr } = await supabase.from('profiles').upsert(
        {
          id: user.id,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          username: v.normalized || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )
      if (upErr) {
        if (upErr.code === '23505') setUsernameError('That username is already taken.')
        throw new Error(upErr.message)
      }
      const derived = await applyDerivedHomeFromAddress(user.id, formattedAddr, precoded)
      if (!derived.success) throw new Error(derived.error || 'Could not save address')
      await updateOnboardingStep(user.id, ONBOARDING_STEP.PREFERENCES)
      await refreshProfile()
      navigation.navigate('PreferencesOnboarding')
    } catch (e) {
      setErr(e?.message || 'Something went wrong.')
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
        {navigation.canGoBack() ? (
          <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
            <Text style={styles.back}>Back</Text>
          </Pressable>
        ) : null}

        <Text style={styles.title}>About You</Text>
        <Text style={styles.sub}>Tell us a bit about yourself</Text>

        {hasGooglePlacesKey() ? (
          <Text style={styles.hintBanner}>Start typing your street address and pick a suggestion.</Text>
        ) : (
          <Text style={styles.hintBanner}>
            Enter your full street address. Add EXPO_PUBLIC_GOOGLE_MAPS_API_KEY for live address suggestions.
          </Text>
        )}

        {err ? <Text style={styles.error}>{err}</Text> : null}

        <Text style={styles.label}>First name</Text>
        <TextInput
          style={styles.input}
          value={firstName}
          onChangeText={setFirstName}
          placeholder="First name"
          placeholderTextColor={authColors.textMuted}
          autoCapitalize="words"
        />

        <Text style={styles.label}>Last name</Text>
        <TextInput
          style={styles.input}
          value={lastName}
          onChangeText={setLastName}
          placeholder="Last name"
          placeholderTextColor={authColors.textMuted}
          autoCapitalize="words"
        />

        <Text style={styles.label}>Username</Text>
        <TextInput
          style={[styles.input, usernameError ? styles.inputErr : null]}
          value={username}
          onChangeText={(t) => {
            setUsername(t.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase())
            setUsernameError('')
          }}
          placeholder="your_handle"
          placeholderTextColor={authColors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {usernameError ? <Text style={styles.error}>{usernameError}</Text> : null}

        <Text style={styles.label}>Home address</Text>
        <AddressAutocompleteField
          value={address}
          onChangeText={onAddressChange}
          placeholder={hasGooglePlacesKey() ? 'Start typing your address' : 'Street, city, state'}
          predictions={predictions}
          predictionsLoading={predLoading}
          onSelectPrediction={onPickPrediction}
          multiline
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
  content: { paddingHorizontal: authSpacing.lg, maxWidth: 520, width: '100%', alignSelf: 'center' },
  back: { fontFamily: authFonts.interMedium, fontSize: 14, color: authColors.textPrimary, marginBottom: authSpacing.lg },
  title: { fontFamily: authFonts.fraunces, fontSize: 40, color: authColors.textPrimary, marginBottom: authSpacing.sm },
  sub: { fontFamily: authFonts.inter, fontSize: 16, color: authColors.textSecondary, marginBottom: authSpacing.md },
  hintBanner: {
    fontFamily: authFonts.inter,
    fontSize: 13,
    color: authColors.textSecondary,
    marginBottom: authSpacing.md,
    lineHeight: 18,
  },
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
  inputErr: { borderColor: authColors.error },
  error: { fontFamily: authFonts.inter, fontSize: 14, color: authColors.error, marginBottom: authSpacing.sm },
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
