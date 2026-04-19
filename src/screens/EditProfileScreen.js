import { useState, useEffect, useCallback, useLayoutEffect, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  FlatList,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { setUserHomeNeighborhood } from '../services/userHomeLocation'
import { applyDerivedHomeFromAddress } from '../services/addressNeighborhood'
import { pickAndUploadProfileAvatar, removeAvatar } from '../services/profileAvatar'
import { checkUsernameAvailable } from '../services/profileUsername'
import { validateUsernameFormat } from '../utils/mentions'
import { colors, fontSizes, fontFamilies, spacing } from '../theme'
import AddressAutocompleteField from '../components/AddressAutocompleteField'
import {
  fetchAddressPredictions,
  fetchPlaceDetails,
  hasGooglePlacesKey,
} from '../services/placesAutocomplete'
import {
  formatUsPhoneDisplayFromDigits,
  normalizeUsPhoneDigits,
  phoneDigitsForStorage,
} from '../utils/phoneFormat'

export default function EditProfileScreen({ navigation }) {
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [username, setUsername] = useState('')
  const [usernameError, setUsernameError] = useState('')
  const [homeNeighborhood, setHomeNeighborhood] = useState('')
  const [homeAddress, setHomeAddress] = useState('')
  const [phoneDisplay, setPhoneDisplay] = useState('')
  const [addressPredictions, setAddressPredictions] = useState([])
  const [addressPredLoading, setAddressPredLoading] = useState(false)
  const [pickedAddressPlace, setPickedAddressPlace] = useState(null)
  const addressDebounceRef = useRef(null)
  const [neighborhoods, setNeighborhoods] = useState([])
  const [hoodModalOpen, setHoodModalOpen] = useState(false)
  const [profileSnapshot, setProfileSnapshot] = useState(null)
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [avatarBusy, setAvatarBusy] = useState(false)

  const load = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const [{ data: profile }, { data: hoods }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('neighborhoods').select('neighborhood_id, name').order('name', { ascending: true }),
      ])
      if (profile) {
        setFirstName(profile.first_name || '')
        setLastName(profile.last_name || '')
        setUsername(profile.username || '')
        setHomeNeighborhood(profile.home_neighborhood_name || '')
        setHomeAddress(profile.home_address || '')
        setPickedAddressPlace(null)
        setAddressPredictions([])
        setPhoneDisplay(
          profile.phone_number ? formatUsPhoneDisplayFromDigits(String(profile.phone_number)) : ''
        )
        setAvatarUrl(profile.avatar_url || null)
        setProfileSnapshot(profile)
      } else {
        const metaName = user.user_metadata?.full_name || user.user_metadata?.name || ''
        if (metaName) {
          const parts = metaName.trim().split(/\s+/)
          setFirstName(parts[0] || '')
          setLastName(parts.slice(1).join(' ') || '')
        }
      }
      setNeighborhoods(hoods || [])
    } catch (e) {
      console.error(e)
      Alert.alert('Error', 'Could not load profile.')
    } finally {
      setLoading(false)
    }
  }, [user?.id, user?.user_metadata])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (pickedAddressPlace && homeAddress.trim() !== pickedAddressPlace.description) {
      setPickedAddressPlace(null)
    }
  }, [homeAddress, pickedAddressPlace])

  useEffect(() => {
    if (!hasGooglePlacesKey()) {
      setAddressPredictions([])
      return
    }
    const q = homeAddress.trim()
    if (q.length < 1 || pickedAddressPlace) {
      setAddressPredictions([])
      return
    }
    if (addressDebounceRef.current) clearTimeout(addressDebounceRef.current)
    addressDebounceRef.current = setTimeout(async () => {
      setAddressPredLoading(true)
      try {
        const list = await fetchAddressPredictions(q)
        setAddressPredictions(list)
      } finally {
        setAddressPredLoading(false)
      }
    }, 400)
    return () => {
      if (addressDebounceRef.current) clearTimeout(addressDebounceRef.current)
    }
  }, [homeAddress, pickedAddressPlace])

  useLayoutEffect(() => {
    navigation.setOptions({
      title: 'Edit Profile',
      headerTitleStyle: {
        fontFamily: fontFamilies.frauncesRegular,
        fontSize: 20,
        color: colors.textPrimary,
      },
      headerStyle: {
        backgroundColor: colors.backgroundElevated,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.border,
      },
      headerShadowVisible: false,
      headerRight: () => null,
    })
  }, [navigation])

  const displayInitial = () => {
    const n = `${firstName || ''} ${lastName || ''}`.trim()
    if (n) return n.charAt(0).toUpperCase()
    const meta = user?.user_metadata?.full_name || user?.user_metadata?.name || ''
    if (meta.trim()) return meta.trim().charAt(0).toUpperCase()
    return '?'
  }

  const pickProfilePhoto = async () => {
    if (!user?.id || avatarBusy) return
    setAvatarBusy(true)
    try {
      const res = await pickAndUploadProfileAvatar(user.id)
      if (res.error === 'PERMISSION_DENIED') {
        Alert.alert('Permission needed', 'Allow photo library access to set your profile picture.')
        return
      }
      if (res.error === 'CANCELLED') return
      if (res.success && res.avatarUrl) setAvatarUrl(res.avatarUrl)
      else Alert.alert('Upload failed', res.error || 'Please try again.')
    } finally {
      setAvatarBusy(false)
    }
  }

  const confirmRemovePhoto = () => {
    if (!user?.id || !avatarUrl || avatarBusy) return
    Alert.alert('Remove profile photo', 'Your profile will show your initial instead.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setAvatarBusy(true)
          try {
            const res = await removeAvatar(user.id)
            if (res.success) setAvatarUrl(null)
            else Alert.alert('Could not remove', res.error || 'Please try again.')
          } finally {
            setAvatarBusy(false)
          }
        },
      },
    ])
  }

  const handleSave = async () => {
    if (!user?.id) return
    setSaving(true)
    try {
      const v = validateUsernameFormat(username)
      if (!v.ok) {
        setUsernameError(v.error || 'Invalid username')
        return
      }
      if (v.normalized && v.normalized !== (profileSnapshot?.username || '').toLowerCase()) {
        const avail = await checkUsernameAvailable(v.normalized, user.id)
        if (!avail.available) {
          setUsernameError(avail.error || 'Username unavailable')
          return
        }
      }
      setUsernameError('')
      const phoneStored = phoneDigitsForStorage(phoneDisplay)
      if (normalizeUsPhoneDigits(phoneDisplay).length > 0 && phoneStored.length !== 10) {
        Alert.alert('Invalid phone', 'Enter a 10-digit US phone number or leave the field empty.')
        return
      }
      const { error } = await supabase.from('profiles').upsert(
        {
          id: user.id,
          first_name: firstName.trim() || null,
          last_name: lastName.trim() || null,
          username: v.normalized || null,
          home_address: homeAddress.trim() || null,
          phone_number: phoneStored || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )
      if (error) {
        if (error.code === '23505') setUsernameError('That username is already taken.')
        throw error
      }

      const prevAddr = (profileSnapshot?.home_address || '').trim()
      const nextAddr = (homeAddress || '').trim()
      const addrChanged = nextAddr !== prevAddr

      if (addrChanged && nextAddr) {
        let formatted = nextAddr
        let precoded = null
        if (pickedAddressPlace?.placeId && hasGooglePlacesKey()) {
          const det = await fetchPlaceDetails(pickedAddressPlace.placeId)
          if (det) {
            formatted = det.formattedAddress || nextAddr
            precoded = { lat: det.lat, lng: det.lng }
            setHomeAddress(formatted)
          }
        }
        const derived = await applyDerivedHomeFromAddress(user.id, formatted, precoded)
        if (!derived.success) throw new Error(derived.error || 'Could not update address')
      } else if (addrChanged && !nextAddr) {
        const { error: clearA } = await supabase
          .from('profiles')
          .update({
            home_address: null,
            home_neighborhood_name: null,
            home_neighborhood_id: null,
            home_lat: null,
            home_lng: null,
            location_source: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id)
        if (clearA) throw clearA
      } else {
        const trimmedHood = (homeNeighborhood || '').trim()
        const prevHood = (profileSnapshot?.home_neighborhood_name || '').trim()
        const hoodChanged = trimmedHood !== prevHood
        if (hoodChanged) {
          if (trimmedHood) {
            const result = await setUserHomeNeighborhood(user.id, trimmedHood)
            if (!result.success) throw new Error(result.error || 'Could not save home neighborhood')
          } else if (profileSnapshot?.home_neighborhood_name || profileSnapshot?.home_neighborhood_id) {
            const { error: clearErr } = await supabase
              .from('profiles')
              .update({
                home_neighborhood_name: null,
                home_neighborhood_id: null,
                home_lat: null,
                home_lng: null,
                location_source: null,
                updated_at: new Date().toISOString(),
              })
              .eq('id', user.id)
            if (clearErr) throw clearErr
          }
        }
      }

      navigation.goBack()
    } catch (err) {
      console.error(err)
      Alert.alert('Save failed', err.message || 'Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.profileAccent} />
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(spacing.xl, insets.bottom) + spacing.lg },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.label}>Profile photo</Text>
        <View style={styles.avatarBlock}>
          <View style={styles.avatarCircle}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImg} resizeMode="cover" />
            ) : (
              <Text style={styles.avatarInitial}>{displayInitial()}</Text>
            )}
            {avatarBusy ? (
              <View style={styles.avatarBusyOverlay}>
                <ActivityIndicator color="#fff" />
              </View>
            ) : null}
          </View>
          <View style={styles.avatarActions}>
            <TouchableOpacity onPress={pickProfilePhoto} disabled={avatarBusy} activeOpacity={0.7}>
              <Text style={styles.avatarLink}>{avatarUrl ? 'Change photo' : 'Add photo'}</Text>
            </TouchableOpacity>
            {avatarUrl ? (
              <TouchableOpacity onPress={confirmRemovePhoto} disabled={avatarBusy} activeOpacity={0.7}>
                <Text style={styles.avatarRemove}>Remove</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        <Text style={styles.label}>First name</Text>
        <TextInput
          style={styles.input}
          value={firstName}
          onChangeText={setFirstName}
          placeholder="First name"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="words"
        />

        <Text style={styles.label}>Last name</Text>
        <TextInput
          style={styles.input}
          value={lastName}
          onChangeText={setLastName}
          placeholder="Last name"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="words"
        />

        <Text style={styles.label}>Username</Text>
        <TextInput
          style={[styles.input, usernameError ? styles.inputError : null]}
          value={username}
          onChangeText={(t) => {
            setUsername(t.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase())
            setUsernameError('')
          }}
          placeholder="your_handle"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {usernameError ? <Text style={styles.errorText}>{usernameError}</Text> : null}
        <Text style={styles.hint}>3–30 characters, letters, numbers, underscores.</Text>

        <Text style={styles.label}>Cell phone</Text>
        <TextInput
          style={styles.input}
          value={phoneDisplay}
          onChangeText={(text) => {
            const d = normalizeUsPhoneDigits(text)
            setPhoneDisplay(formatUsPhoneDisplayFromDigits(d))
          }}
          placeholder="763-439-2450"
          placeholderTextColor={colors.textMuted}
          keyboardType="phone-pad"
        />

        <Text style={styles.label}>Home address</Text>
        <AddressAutocompleteField
          value={homeAddress}
          onChangeText={setHomeAddress}
          placeholder={hasGooglePlacesKey() ? 'Start typing your address' : 'Street, city, state'}
          placeholderTextColor={colors.textMuted}
          predictions={addressPredictions}
          predictionsLoading={addressPredLoading}
          onSelectPrediction={(p) => {
            setPickedAddressPlace({ placeId: p.placeId, description: p.description })
            setHomeAddress(p.description)
            setAddressPredictions([])
          }}
          multiline
          minHeight={72}
        />
        <Text style={styles.hint}>We use this to suggest neighborhoods and nearby spots.</Text>

        <Text style={styles.label}>Home neighborhood</Text>
        <TouchableOpacity style={styles.selectBtn} onPress={() => setHoodModalOpen(true)} activeOpacity={0.7}>
          <Text style={homeNeighborhood ? styles.selectValue : styles.selectPlaceholder}>
            {homeNeighborhood || 'None'}
          </Text>
          <Text style={styles.chev}>▼</Text>
        </TouchableOpacity>
        <Text style={styles.hint}>Used for default recommendations in Chicago.</Text>

        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving || !!usernameError}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveText}>Save</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={hoodModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Home neighborhood</Text>
              <TouchableOpacity onPress={() => setHoodModalOpen(false)}>
                <Text style={styles.modalDone}>Done</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.modalRow}
              onPress={() => {
                setHomeNeighborhood('')
                setHoodModalOpen(false)
              }}
            >
              <Text style={styles.modalRowText}>None</Text>
            </TouchableOpacity>
            <FlatList
              data={neighborhoods}
              keyExtractor={(item) => String(item.neighborhood_id)}
              style={styles.modalList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalRow}
                  onPress={() => {
                    setHomeNeighborhood(item.name)
                    setHoodModalOpen(false)
                  }}
                >
                  <Text style={styles.modalRowText}>{item.name}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  container: { flex: 1 },
  content: { padding: spacing.lg, paddingTop: spacing.md },
  avatarBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  avatarCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(228,228,231,0.9)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarInitial: {
    fontSize: fontSizes['3xl'],
    fontFamily: fontFamilies.fraunces,
    color: colors.textMuted,
  },
  avatarBusyOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarActions: { flex: 1, gap: spacing.sm },
  avatarLink: {
    fontSize: fontSizes.base,
    fontFamily: fontFamilies.interMedium,
    color: colors.profileAccent,
  },
  avatarRemove: {
    fontSize: fontSizes.sm,
    fontFamily: fontFamilies.interMedium,
    color: colors.textMuted,
  },
  label: {
    fontSize: fontSizes.sm,
    fontFamily: fontFamilies.interMedium,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  inputError: { borderColor: '#b91c1c' },
  errorText: { fontSize: fontSizes.xs, color: '#b91c1c', marginBottom: spacing.sm },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(228,228,231,0.9)',
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSizes.base,
    color: colors.textPrimary,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
  },
  hint: { fontSize: fontSizes.xs, color: colors.textMuted, marginBottom: spacing.md, lineHeight: 18 },
  selectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(228,228,231,0.9)',
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    marginBottom: spacing.xs,
  },
  selectValue: { fontSize: fontSizes.base, color: colors.textPrimary, flex: 1 },
  selectPlaceholder: { fontSize: fontSizes.base, color: colors.textMuted, flex: 1 },
  chev: { fontSize: 10, color: colors.textMuted, marginLeft: 8 },
  saveBtn: {
    backgroundColor: colors.profileAccent,
    borderRadius: 8,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  saveBtnDisabled: { opacity: 0.7 },
  saveText: { color: '#fff', fontSize: fontSizes.base, fontFamily: fontFamilies.interMedium },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '72%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(228,228,231,0.6)',
  },
  modalTitle: { fontSize: fontSizes.lg, fontFamily: fontFamilies.fraunces, color: colors.textPrimary },
  modalDone: { fontSize: fontSizes.base, color: colors.profileAccent, fontFamily: fontFamilies.interMedium },
  modalList: { maxHeight: 400 },
  modalRow: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderBottomWidth: 1, borderBottomColor: 'rgba(228,228,231,0.4)' },
  modalRowText: { fontSize: fontSizes.base, color: colors.textPrimary },
})
