import { useState, useCallback, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '../../contexts/AuthContext'
import { getGroupedPreferences, getUserPreferenceIds, saveUserPreferences } from '../../utils/preferences'
import { completeOnboarding } from '../../services/profileOnboarding'
import { useFocusEffect } from '@react-navigation/native'
import { authColors, authFonts, authSpacing } from '../../theme/authTheme'
import { colors, fontSizes, fontFamilies, spacing, borderRadius } from '../../theme'
import { onboardingScrollContentBase, onboardingHeaderStyles } from '../../theme/onboardingLayout'
import OnboardingBackRow from '../../components/onboarding/OnboardingBackRow'

/**
 * Same per-category caps and UI language as `EditPreferencesScreen` (all categories, same chips/fonts).
 */
const CATEGORY_LIMITS = {
  food: 8,
  drink: 5,
  dietary: null,
  vibe: 5,
  occasion: 4,
}

export default function PreferencesOnboardingScreen({ navigation }) {
  const insets = useSafeAreaInsets()
  const { user, refreshProfile } = useAuth()
  const [categories, setCategories] = useState([])
  const [preferences, setPreferences] = useState([])
  const [selectedIds, setSelectedIds] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const hasLoadedOnce = useRef(false)

  const load = useCallback(async () => {
    if (!user?.id) return
    if (!hasLoadedOnce.current) setLoading(true)
    setErr('')
    try {
      const { categories: cats, preferences: prefs } = await getGroupedPreferences()
      setCategories(cats || [])
      setPreferences(prefs || [])
      const ids = await getUserPreferenceIds(user.id)
      setSelectedIds(ids)
    } catch (e) {
      setErr(e?.message || 'Failed to load')
    } finally {
      setLoading(false)
      hasLoadedOnce.current = true
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

  const onBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack()
    } else {
      navigation.navigate('AboutYou')
    }
  }

  if (loading && !hasLoadedOnce.current) {
    return (
      <View style={[styles.flex, onboardingScrollContentBase(insets, 0)]}>
        <OnboardingBackRow onPress={onBack} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={authColors.accent} />
        </View>
      </View>
    )
  }

  return (
    <View style={styles.flex}>
      <ScrollView
        contentContainerStyle={[styles.contentGrow, onboardingScrollContentBase(insets, 0)]}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews={false}
        showsVerticalScrollIndicator
      >
        <OnboardingBackRow onPress={onBack} />

        <Text style={onboardingHeaderStyles.title}>Your Preferences</Text>
        <Text style={onboardingHeaderStyles.sub}>
          Favorite cuisines, atmosphere, and dietary needs — the more preferences you select, the better your
          recommendations will be.
        </Text>

        {err ? <Text style={styles.error}>{err}</Text> : null}

        {categories.length === 0 || preferences.length === 0 ? (
          <Text style={styles.empty}>No preferences available.</Text>
        ) : (
          categories.map((category) => {
            const prefs = prefsByCategory(category.preference_category_id)
            if (prefs.length === 0) return null

            const selectedCount = selectedInCategory(category.preference_category_id).length
            const limit = category?.slug ? CATEGORY_LIMITS[category.slug] : null
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
                        style={({ pressed }) => [
                          styles.chip,
                          isSelected && styles.chipSelected,
                          disabled && styles.chipDisabled,
                          pressed && !disabled && styles.chipPressed,
                        ]}
                        onPress={() => handleToggle(pref)}
                        disabled={disabled}
                      >
                        <Text
                          style={[styles.chipLabel, isSelected && styles.chipLabelSelected]}
                          numberOfLines={2}
                        >
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
          disabled={saving || categories.length === 0}
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
  contentGrow: { flexGrow: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: 200 },
  section: {
    marginBottom: spacing.xl,
    backgroundColor: colors.backgroundElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.base,
  },
  sectionTitle: {
    fontSize: fontSizes.base,
    fontFamily: fontFamilies.frauncesSemiBold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  limitText: {
    fontFamily: fontFamilies.inter,
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundElevated,
    maxWidth: '100%',
  },
  chipPressed: { opacity: 0.85 },
  chipSelected: {
    backgroundColor: colors.profileAccent,
    borderColor: colors.profileAccentPressed,
  },
  chipDisabled: { opacity: 0.45 },
  chipLabel: {
    fontSize: fontSizes.sm,
    fontFamily: fontFamilies.interMedium,
    color: colors.textPrimary,
  },
  chipLabelSelected: {
    color: colors.textOnDark,
  },
  primaryBtn: {
    marginTop: spacing.lg,
    backgroundColor: authColors.accent,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  primaryBtnText: { fontFamily: authFonts.interMedium, fontSize: 16, color: authColors.onAccent },
  skip: { alignItems: 'center', paddingVertical: authSpacing.lg },
  skipText: { fontFamily: authFonts.interMedium, fontSize: 14, color: authColors.textSecondary },
  error: { fontFamily: authFonts.inter, fontSize: 14, color: authColors.error, marginBottom: authSpacing.md },
  empty: { fontSize: fontSizes.sm, color: colors.textMuted, marginBottom: spacing.lg },
  disabled: { opacity: 0.7 },
})
