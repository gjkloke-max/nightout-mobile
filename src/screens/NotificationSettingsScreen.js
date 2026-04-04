import { useState, useEffect, useCallback, useLayoutEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  ActivityIndicator,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '../contexts/AuthContext'
import { getNotificationPreferences, upsertNotificationPreferences } from '../services/notifications'
import { mergeNotificationSettings } from '../services/notificationPreferences'
import { colors, fontSizes, fontFamilies, spacing } from '../theme'

const CATEGORIES = [
  { key: 'follows', label: 'Follows' },
  { key: 'follow_requests', label: 'Follow requests' },
  { key: 'replies', label: 'Replies' },
  { key: 'mentions', label: 'Mentions' },
  { key: 'likes', label: 'Likes' },
  { key: 'lists', label: 'Lists' },
  { key: 'collaboration', label: 'Collaboration' },
  { key: 'social_activity', label: 'Social activity' },
]

const CHANNELS = [
  { key: 'in_app_enabled', label: 'In-app' },
  { key: 'mobile_push_enabled', label: 'Mobile push' },
  { key: 'web_push_enabled', label: 'Browser / web push' },
]

export default function NotificationSettingsScreen() {
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const { user } = useAuth()

  useLayoutEffect(() => {
    navigation.setOptions({
      title: 'Notification Settings',
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
  const [settings, setSettings] = useState(() => mergeNotificationSettings(null))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    setError(null)
    try {
      const s = await getNotificationPreferences(user.id)
      setSettings(s)
    } catch (e) {
      setError(e?.message || 'Failed to load')
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
    setError(null)
    try {
      const r = await upsertNotificationPreferences(user.id, next)
      if (!r.success) setError(r.error || 'Could not save')
    } catch (e) {
      setError(e?.message || 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  const updateChannel = (catKey, channelKey, value) => {
    setSettings((prev) => {
      const next = {
        ...prev,
        [catKey]: { ...prev[catKey], [channelKey]: value },
      }
      persist(next)
      return next
    })
  }

  if (loading) {
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
    >
      <Text style={styles.intro}>
        Choose how you get notified for each category. In-app notifications appear in your feed; push options
        apply when those features are enabled on your device.
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {saving ? (
        <Text style={styles.saving}>Saving…</Text>
      ) : null}

      {CATEGORIES.map(({ key, label }) => (
        <View key={key} style={styles.section}>
          <Text style={styles.sectionTitle}>{label}</Text>
          {CHANNELS.map(({ key: chKey, label: chLabel }, i) => (
            <View key={`${key}-${chKey}`} style={[styles.row, i > 0 && styles.rowDivider]}>
              <Text style={styles.rowLabel}>{chLabel}</Text>
              <Switch
                value={!!settings[key]?.[chKey]}
                onValueChange={(v) => updateChannel(key, chKey, v)}
                trackColor={{ false: colors.border, true: 'rgba(157, 23, 77, 0.45)' }}
                thumbColor={settings[key]?.[chKey] ? colors.profileAccent : colors.backgroundElevated}
                ios_backgroundColor={colors.border}
              />
            </View>
          ))}
        </View>
      ))}
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
  saving: { fontSize: fontSizes.xs, color: colors.textMuted, marginBottom: spacing.sm },
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  rowLabel: {
    flex: 1,
    fontSize: fontSizes.sm,
    fontFamily: fontFamilies.inter,
    color: colors.textPrimary,
    marginRight: spacing.md,
  },
})
