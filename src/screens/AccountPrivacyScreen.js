import { useState, useEffect, useCallback, useLayoutEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { colors, fontSizes, fontFamilies, spacing } from '../theme'

/** Account privacy — matches Settings row; Figma 123:2399 flow */
export default function AccountPrivacyScreen() {
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isPrivate, setIsPrivate] = useState(false)

  useLayoutEffect(() => {
    navigation.setOptions({
      title: 'Account Privacy',
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
    if (!user?.id) return
    setLoading(true)
    try {
      const { data } = await supabase.from('profiles').select('is_private').eq('id', user.id).single()
      setIsPrivate(!!data?.is_private)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    load()
  }, [load])

  const persist = async (next) => {
    if (!user?.id) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_private: next, updated_at: new Date().toISOString() })
        .eq('id', user.id)
      if (error) throw error
      setIsPrivate(next)
    } catch (e) {
      Alert.alert('Could not save', e?.message || 'Try again.')
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
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingBottom: Math.max(spacing.xl, insets.bottom + spacing.lg) }]}
    >
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.label}>Private account</Text>
          {saving ? (
            <ActivityIndicator color={colors.profileAccent} />
          ) : (
            <Switch
              value={isPrivate}
              onValueChange={(v) => persist(v)}
              trackColor={{ false: colors.border, true: 'rgba(157, 23, 77, 0.45)' }}
              thumbColor={isPrivate ? colors.profileAccent : colors.backgroundElevated}
              ios_backgroundColor={colors.border}
            />
          )}
        </View>
        <Text style={styles.hint}>
          Private accounts require approval for new followers. Your profile and activity are only visible to approved
          followers.
        </Text>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.backgroundCanvas },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.backgroundCanvas },
  content: { padding: spacing.lg, paddingTop: spacing.lg },
  card: {
    backgroundColor: colors.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  label: {
    flex: 1,
    fontSize: fontSizes.base,
    fontFamily: fontFamilies.interMedium,
    color: colors.textPrimary,
  },
  hint: {
    marginTop: spacing.md,
    fontSize: fontSizes.sm,
    fontFamily: fontFamilies.inter,
    color: colors.textSecondary,
    lineHeight: 20,
  },
})
