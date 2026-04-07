import { useState, useCallback, useLayoutEffect, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native'
import { useNavigation, useFocusEffect } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '../contexts/AuthContext'
import { getGroupedPreferences, getUserPreferenceIds, saveUserPreferences } from '../utils/preferences'
import { colors, fontSizes, fontFamilies, spacing, borderRadius } from '../theme'

/**
 * Same per-category caps as web `GroupedPreferences.jsx` (slug → max selections).
 * Dietary has no cap in that map (null → unlimited).
 */
const CATEGORY_LIMITS = {
  food: 8,
  drink: 5,
  dietary: null,
  vibe: 5,
  occasion: 4,
}

export default function EditPreferencesScreen() {
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const { user } = useAuth()

  const [categories, setCategories] = useState([])
  const [preferences, setPreferences] = useState([])
  const [selectedIds, setSelectedIds] = useState([])
  const [loading, setLoading] = useState(true)
  const hasLoadedOnce = useRef(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  useLayoutEffect(() => {
    navigation.setOptions({
      title: 'Edit Preferences',
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

  const load = useCallback(async () => {
    if (!user?.id) {
      setLoading(false)
      return
    }
    if (!hasLoadedOnce.current) setLoading(true)
    setError(null)
    try {
      const { categories: cats, preferences: prefs } = await getGroupedPreferences()
      setCategories(cats || [])
      setPreferences(prefs || [])
      const ids = await getUserPreferenceIds(user.id)
      setSelectedIds(ids)
    } catch (e) {
      setError(e?.message || 'Failed to load preferences')
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
    const count = selectedInCategory(category.preference_category_id).length
    return count < limit
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
      setSuccess(null)
    }
  }

  const handleSave = async () => {
    if (!user?.id) return
    setSaving(true)
    setError(null)
    setSuccess(null)
    const result = await saveUserPreferences(user.id, selectedIds)
    setSaving(false)
    if (!result.success) {
      setError(result.error || 'Failed to save preferences')
      return
    }
    const refreshed = await getUserPreferenceIds(user.id)
    setSelectedIds(refreshed)
    setSuccess('Preferences saved successfully!')
    setTimeout(() => setSuccess(null), 3000)
  }

  if (loading && !hasLoadedOnce.current) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.profileAccent} />
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing['2xl'] }]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.intro}>
        Express your taste — select what you love. Tap Save preferences when you are done.
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {success ? <Text style={styles.success}>{success}</Text> : null}

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
        style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
        onPress={handleSave}
        disabled={saving || categories.length === 0}
      >
        {saving ? (
          <ActivityIndicator color={colors.textOnDark} />
        ) : (
          <Text style={styles.saveBtnText}>Save preferences</Text>
        )}
      </Pressable>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  intro: {
    fontSize: fontSizes.sm,
    fontFamily: fontFamilies.inter,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  error: { fontSize: fontSizes.sm, color: colors.error, marginBottom: spacing.sm },
  success: { fontSize: fontSizes.sm, color: colors.success, marginBottom: spacing.sm },
  empty: { fontSize: fontSizes.sm, color: colors.textMuted, marginBottom: spacing.lg },
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
  chipDisabled: {
    opacity: 0.45,
  },
  chipLabel: {
    fontSize: fontSizes.sm,
    fontFamily: fontFamilies.interMedium,
    color: colors.textPrimary,
  },
  chipLabelSelected: {
    color: colors.textOnDark,
  },
  saveBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.backgroundDark,
    borderRadius: borderRadius.full,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: {
    fontSize: fontSizes.base,
    fontFamily: fontFamilies.interSemiBold,
    color: colors.textOnDark,
  },
})
