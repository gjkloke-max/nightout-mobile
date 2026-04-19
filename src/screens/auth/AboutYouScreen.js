import { useState, useEffect, useRef, useMemo } from 'react'
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
  Keyboard,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ChevronRight } from 'lucide-react-native'
import { authColors, authFonts, authSpacing } from '../../theme/authTheme'
import { onboardingScrollContentBase, onboardingHeaderStyles } from '../../theme/onboardingLayout'
import OnboardingBackRow from '../../components/onboarding/OnboardingBackRow'
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

const PRIVACY_NOTE = 'Private · Used only for location-based recommendations'

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
  const scrollRef = useRef(null)
  const addressSectionY = useRef(0)
  const [keyboardInset, setKeyboardInset] = useState(0)

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
    if (q.length < 1 || pickedPlace) {
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

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'
    const show = Keyboard.addListener(showEvt, (e) => {
      setKeyboardInset(e.endCoordinates?.height ?? 0)
    })
    const hide = Keyboard.addListener(hideEvt, () => setKeyboardInset(0))
    return () => {
      show.remove()
      hide.remove()
    }
  }, [])

  useEffect(() => {
    if ((predictions.length > 0 || predLoading) && keyboardInset > 0) {
      const t = setTimeout(() => {
        scrollRef.current?.scrollTo({
          y: Math.max(0, addressSectionY.current - 28),
          animated: true,
        })
      }, 100)
      return () => clearTimeout(t)
    }
  }, [predictions.length, predLoading, keyboardInset])

  const usernameCheck = useMemo(() => validateUsernameFormat(username), [username])

  const canContinue = useMemo(() => {
    if (loading) return false
    if (!firstName.trim() || !lastName.trim()) return false
    if (!usernameCheck.ok) return false
    if (!address.trim()) return false
    if (hasGooglePlacesKey() && !pickedPlace?.placeId) return false
    return true
  }, [loading, firstName, lastName, usernameCheck.ok, address, pickedPlace?.placeId])

  const dismissSuggestions = () => setPredictions([])

  const onBack = () => {
    dismissSuggestions()
    navigation.navigate('GetStarted')
  }

  const onAddressInputFocus = () => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, addressSectionY.current - 32),
        animated: true,
      })
    })
  }

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
    if (!user?.id || !canContinue) return
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

  // Extra scroll height so address suggestions stay above the keyboard while typing.
  const scrollExtraBottom =
    (predictions.length > 0 || predLoading ? 300 : 0) + (keyboardInset > 0 ? keyboardInset + 48 : 0)

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[
          styles.contentGrow,
          onboardingScrollContentBase(insets, scrollExtraBottom),
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onScrollBeginDrag={dismissSuggestions}
        removeClippedSubviews={false}
        showsVerticalScrollIndicator
      >
        <OnboardingBackRow onPress={onBack} />

        <Text style={onboardingHeaderStyles.title}>About You</Text>
        <Text style={onboardingHeaderStyles.sub}>Tell us a bit about yourself</Text>

        {err ? <Text style={styles.error}>{err}</Text> : null}

        <View style={styles.nameLabelsRow}>
          <Text style={[styles.label, styles.nameCol]}>First name</Text>
          <Text style={[styles.label, styles.nameCol]}>Last name</Text>
        </View>
        <View style={styles.nameInputsRow}>
          <TextInput
            style={[styles.input, styles.nameInput]}
            value={firstName}
            onChangeText={setFirstName}
            placeholder="First name"
            placeholderTextColor={authColors.textMuted}
            autoCapitalize="words"
          />
          <TextInput
            style={[styles.input, styles.nameInput]}
            value={lastName}
            onChangeText={setLastName}
            placeholder="Last name"
            placeholderTextColor={authColors.textMuted}
            autoCapitalize="words"
          />
        </View>

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
        {usernameError ? <Text style={styles.errorInline}>{usernameError}</Text> : null}

        <Text style={[styles.label, styles.addressLabel]}>Home address</Text>
        <View
          style={styles.addressBlock}
          collapsable={false}
          onLayout={(e) => {
            addressSectionY.current = e.nativeEvent.layout.y
          }}
        >
          <AddressAutocompleteField
            value={address}
            onChangeText={onAddressChange}
            placeholder={hasGooglePlacesKey() ? 'Start typing your address' : 'Street, city, state'}
            predictions={predictions}
            predictionsLoading={predLoading}
            onSelectPrediction={onPickPrediction}
            multiline={false}
            minHeight={52}
            onInputFocus={onAddressInputFocus}
          />
        </View>
        <Text style={styles.privacyNote}>{PRIVACY_NOTE}</Text>

        <Pressable
          style={[styles.continue, (!canContinue || loading) && styles.continueDisabled]}
          onPress={onContinue}
          disabled={!canContinue || loading}
        >
          {loading ? (
            <ActivityIndicator color={authColors.onAccent} />
          ) : (
            <View style={styles.continueInner}>
              <Text style={styles.continueText}>Continue</Text>
              <ChevronRight size={22} color={authColors.onAccent} strokeWidth={2.2} style={styles.continueChevron} />
            </View>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: authColors.canvas },
  scroll: { flex: 1, backgroundColor: authColors.canvas, overflow: 'visible' },
  contentGrow: { flexGrow: 1, overflow: 'visible' },
  addressBlock: {
    zIndex: 50,
    elevation: Platform.OS === 'android' ? 12 : 0,
    position: 'relative',
  },
  nameLabelsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: authSpacing.xs,
  },
  nameCol: { flex: 1, marginBottom: 0 },
  nameInputsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: authSpacing.md,
  },
  nameInput: { flex: 1, marginBottom: 0 },
  label: {
    fontFamily: authFonts.interMedium,
    fontSize: 14,
    color: authColors.textPrimary,
    marginBottom: authSpacing.xs,
  },
  addressLabel: { marginTop: authSpacing.xs },
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
  error: { fontFamily: authFonts.inter, fontSize: 14, color: authColors.error, marginBottom: authSpacing.md },
  errorInline: {
    fontFamily: authFonts.inter,
    fontSize: 14,
    color: authColors.error,
    marginTop: -authSpacing.sm,
    marginBottom: authSpacing.sm,
  },
  privacyNote: {
    fontFamily: authFonts.inter,
    fontSize: 12,
    lineHeight: 17,
    color: authColors.textMuted,
    marginTop: authSpacing.sm,
    marginBottom: authSpacing.lg,
  },
  continue: {
    marginTop: authSpacing.sm,
    backgroundColor: authColors.accent,
    minHeight: 56,
    paddingVertical: 16,
    paddingHorizontal: authSpacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  continueDisabled: { opacity: 0.45 },
  continueInner: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  continueText: { fontFamily: authFonts.interMedium, fontSize: 16, color: authColors.onAccent },
  continueChevron: { position: 'absolute', right: 4 },
})
