import { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  Modal,
  FlatList,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { setUserHomeNeighborhood } from '../services/userHomeLocation'
import { colors, fontSizes, fontFamilies, spacing } from '../theme'

export default function EditProfileScreen({ navigation }) {
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [homeNeighborhood, setHomeNeighborhood] = useState('')
  const [neighborhoods, setNeighborhoods] = useState([])
  const [hoodModalOpen, setHoodModalOpen] = useState(false)
  const [profileSnapshot, setProfileSnapshot] = useState(null)

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
        setIsPrivate(!!profile.is_private)
        setHomeNeighborhood(profile.home_neighborhood_name || '')
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

  const handleSave = async () => {
    if (!user?.id) return
    setSaving(true)
    try {
      const { error } = await supabase.from('profiles').upsert(
        {
          id: user.id,
          first_name: firstName.trim() || null,
          last_name: lastName.trim() || null,
          is_private: !!isPrivate,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )
      if (error) throw error

      const trimmedHood = (homeNeighborhood || '').trim()
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
          })
          .eq('id', user.id)
        if (clearErr) throw clearErr
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

        <View style={styles.row}>
          <Text style={styles.labelInline}>Private account</Text>
          <Switch value={isPrivate} onValueChange={setIsPrivate} trackColor={{ false: '#ccc', true: colors.profileAccent }} />
        </View>
        <Text style={styles.hint}>
          Private accounts require approval for new followers. Your profile is only visible to approved followers.
        </Text>

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
          disabled={saving}
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
  label: {
    fontSize: fontSizes.sm,
    fontFamily: fontFamilies.interMedium,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  labelInline: { fontSize: fontSizes.base, fontFamily: fontFamilies.interMedium, color: colors.textPrimary, flex: 1 },
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
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
