import { useState, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ChevronLeft } from 'lucide-react-native'
import { authColors, authFonts, authSpacing } from '../../theme/authTheme'
import { useAuth } from '../../contexts/AuthContext'
import { getGroupedPreferences, getUserPreferenceIds, saveUserPreferences } from '../../utils/preferences'
import { completeOnboarding } from '../../services/profileOnboarding'
import { useFocusEffect } from '@react-navigation/native'

const CATEGORY_LIMITS = {
  food: 8,
  drink: 5,
  dietary: null,
  vibe: 5,
  occasion: 4,
}

const ONBOARDING_SLUGS = new Set(['food', 'vibe', 'dietary'])

export default function PreferencesOnboardingScreen({ navigation }) {
  const insets = useSafeAreaInsets()
  const { user, refreshProfile } = useAuth()
  const [categories, setCategories] = useState([])
  const [preferences, setPreferences] = useState([])
  const [selectedIds, setSelectedIds] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    setErr('')
    try {
      const { categories: cats, preferences: prefs } = await getGroupedPreferences()
      const filteredCats = (cats || []).filter((c) => ONBOARDING_SLUGS.has(c.slug))
      setCategories(filteredCats)
      setPreferences(prefs || [])
      const ids = await getUserPreferenceIds(user.id)
      setSelectedIds(ids)
    } catch (e) {
      setErr(e?.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load])
  )

  const prefsByCategory = (catId) => preferences.filter((p) => p.preference_category_id === catId)

  const selectedInCategory = (catId) =>
    selectedIds.filter((id) => {
      const pref = preferences.find((p) => p.preference_master_id === id)
      return pref?.preference_category_id === catId
    })

  const canSelectMore = (category) => {
    const limit = category?.slug ? CATEGORY_LIMITS[category.slug] : null
    if (limit == null) return true
    return selectedInCategory(category.preference_category_id).length < limit
  }

  const handleToggle = (pref) => {
    const cat = categories.find((c) => c.preference_category_id === pref.preference_category_id)
    const isSelected = selectedIds.includes(pref.preference_master_id)
    if (isSelected || canSelectMore(cat)) {
      setSelectedIds((prev) =>
        prev.includes(pref.preference_master_id)
          ? prev.filter((x) => x !== pref.preference_master_id)
          : [...prev, pref.preference_master_id]
      )
    }
  }

  const finish = async (skipPreferences) => {
    if (!user?.id) return
    setSaving(true)
    setErr('')
    try {
      if (!skipPreferences) {
        const res = await saveUserPreferences(user.id, selectedIds)
        if (!res.success) throw new Error(res.error || 'Save failed')
      }
      const done = await completeOnboarding(user.id)
      if (!done.success) throw new Error(done.error || 'Could not finish onboarding')
      await refreshProfile()
    } catch (e) {
      setErr(e?.message || 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <View style={[styles.flex, { paddingTop: insets.top, paddingHorizontal: authSpacing.lg }]}>
        <Pressable
          onPress={() => navigation.navigate('AboutYou')}
          hitSlop={12}
          style={styles.backWrap}
          accessibilityRole="button"
        >
          <View style={styles.backRow}>
            <ChevronLeft size={22} color={authColors.textPrimary} strokeWidth={2} />
            <Text style={styles.back}>Back</Text>
          </View>
        </Pressable>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={authColors.accent} />
        </View>
      </View>
    )
  }

  return (
    <View style={[styles.flex, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews={false}
      >
        <Pressable
          onPress={() => navigation.navigate('AboutYou')}
          hitSlop={12}
          style={styles.backWrap}
          accessibilityRole="button"
        >
          <View style={styles.backRow}>
            <ChevronLeft size={22} color={authColors.textPrimary} strokeWidth={2} />
            <Text style={styles.back}>Back</Text>
          </View>
        </Pressable>

        <Text style={styles.title}>Your Preferences</Text>
        <Text style={styles.sub}>Favorite cuisines, atmosphere, and dietary needs</Text>
        {err ? <Text style={styles.error}>{err}</Text> : null}

        {categories.length === 0 ? (
          <Text style={styles.empty}>No preference categories available.</Text>
        ) : (
          categories.map((category) => {
            const prefs = prefsByCategory(category.preference_category_id)
            if (prefs.length === 0) return null
            const limit = category?.slug ? CATEGORY_LIMITS[category.slug] : null
            const selectedCount = selectedInCategory(category.preference_category_id).length
            const limitLabel = limit != null ? ` (${selectedCount}/${limit})` : ''
            return (
              <View key={category.preference_category_id} style={styles.section}>
                <Text style={styles.sectionTitle}>
                  {category.name}
                  {limit != null ? <Text style={styles.limitText}>{limitLabel}</Text> : null}
                </Text>
                <View style={styles.chipWrap}>
                  {prefs.map((pref) => {
                    const isSelected = selectedIds.includes(pref.preference_master_id)
                    const cat = category
                    const disabled = !isSelected && !canSelectMore(cat)
                    return (
                      <Pressable
                        key={pref.preference_master_id}
                        style={[
                          styles.chip,
                          isSelected && styles.chipSelected,
                          disabled && styles.chipDisabled,
                        ]}
                        onPress={() => handleToggle(pref)}
                        disabled={disabled}
                      >
                        <Text style={[styles.chipLabel, isSelected && styles.chipLabelSelected]} numberOfLines={2}>
                          {pref.preference_name}
                        </Text>
                      </Pressable>
                    )
                  })}
                </View>
              </View>
            )
          })
        )}

        <Pressable
          style={[styles.primaryBtn, saving && styles.disabled]}
          onPress={() => finish(false)}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={authColors.onAccent} />
          ) : (
            <Text style={styles.primaryBtnText}>Get Started</Text>
          )}
        </Pressable>

        <Pressable style={styles.skip} onPress={() => finish(true)} disabled={saving}>
          <Text style={styles.skipText}>Skip for now</Text>
        </Pressable>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: authColors.canvas },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: authSpacing.lg, paddingBottom: authSpacing.xxl, maxWidth: 520, alignSelf: 'center', width: '100%' },
  backWrap: { alignSelf: 'flex-start', marginBottom: authSpacing.lg, zIndex: 20 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 44 },
  back: { fontFamily: authFonts.interMedium, fontSize: 14, color: authColors.textPrimary },
  title: { fontFamily: authFonts.fraunces, fontSize: 40, color: authColors.textPrimary, marginBottom: authSpacing.sm },
  sub: { fontFamily: authFonts.inter, fontSize: 16, color: authColors.textSecondary, marginBottom: authSpacing.xl },
  section: { marginBottom: authSpacing.lg },
  sectionTitle: { fontFamily: authFonts.interMedium, fontSize: 14, color: authColors.textPrimary, marginBottom: authSpacing.sm },
  limitText: { fontFamily: authFonts.inter, color: authColors.textSecondary },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: authSpacing.sm },
  chip: {
    borderWidth: 1,
    borderColor: authColors.border,
    paddingVertical: authSpacing.sm,
    paddingHorizontal: authSpacing.md,
    backgroundColor: authColors.surface,
  },
  chipSelected: { backgroundColor: authColors.textPrimary, borderColor: authColors.textPrimary },
  chipDisabled: { opacity: 0.45 },
  chipLabel: { fontFamily: authFonts.inter, fontSize: 14, color: authColors.textPrimary, maxWidth: 160 },
  chipLabelSelected: { color: authColors.surface },
  primaryBtn: {
    marginTop: authSpacing.lg,
    backgroundColor: authColors.accent,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { fontFamily: authFonts.interMedium, fontSize: 16, color: authColors.onAccent },
  skip: { alignItems: 'center', paddingVertical: authSpacing.lg },
  skipText: { fontFamily: authFonts.interMedium, fontSize: 14, color: authColors.textSecondary },
  error: { fontFamily: authFonts.inter, fontSize: 14, color: authColors.error, marginBottom: authSpacing.md },
  empty: { fontFamily: authFonts.inter, color: authColors.textSecondary },
  disabled: { opacity: 0.7 },
})
