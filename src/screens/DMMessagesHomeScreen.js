import { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Pressable,
} from 'react-native'
import { useNavigation, useFocusEffect } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MessageSquarePlus, ChevronLeft } from 'lucide-react-native'
import { useAuth } from '../contexts/AuthContext'
import { listConversations, displayNameFromProfile } from '../services/messaging'
import { formatDmRelativeTime } from '../utils/dmRelativeTime'
import { colors, fontFamilies, fontSizes, fontWeights, spacing, borderRadius } from '../theme'

export default function DMMessagesHomeScreen() {
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    if (!user?.id) return
    listConversations(user.id).then(setRows).finally(() => setLoading(false))
  }, [user?.id])

  useFocusEffect(
    useCallback(() => {
      setLoading(true)
      load()
    }, [load])
  )

  useEffect(() => {
    const t = setInterval(load, 20000)
    return () => clearInterval(t)
  }, [load])

  const renderItem = ({ item: row }) => {
    const name = displayNameFromProfile({
      first_name: row.other_first_name,
      last_name: row.other_last_name,
    })
    const initials = name
      .split(/\s+/)
      .map((s) => s[0])
      .join('')
      .slice(0, 2)
      .toUpperCase()
    const unread = row.unread_count > 0
    const preview = row.last_message_body || ''
    const time = formatDmRelativeTime(row.last_message_at || row.updated_at)

    return (
      <Pressable
        style={styles.row}
        onPress={() => navigation.navigate('DMConversation', { conversationId: row.conversation_id })}
      >
        <View style={styles.avatar}>
          {row.other_avatar_url ? (
            <Image source={{ uri: row.other_avatar_url }} style={styles.avatarImg} />
          ) : (
            <Text style={styles.avatarText}>{initials}</Text>
          )}
        </View>
        <View style={styles.rowMain}>
          <View style={styles.rowTop}>
            <Text style={[styles.name, unread && styles.nameUnread]} numberOfLines={1}>
              {name}
            </Text>
            <Text style={styles.time}>{time}</Text>
          </View>
          <Text style={[styles.preview, unread ? styles.previewActive : styles.previewMuted]} numberOfLines={1}>
            {preview || '—'}
          </Text>
        </View>
        {unread ? <View style={styles.dot} /> : <View style={{ width: 8 }} />}
      </Pressable>
    )
  }

  return (
    <View style={[styles.container, { paddingTop: Math.max(spacing.lg, insets.top) }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn} hitSlop={12} accessibilityLabel="Back">
          <ChevronLeft size={24} color={colors.textPrimary} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} pointerEvents="none">
          Messages
        </Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('DMNewMessage')}
          style={styles.headerBtn}
          hitSlop={12}
          accessibilityLabel="New message"
        >
          <MessageSquarePlus size={22} color={colors.textPrimary} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <Text style={styles.empty}>Loading…</Text>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.conversation_id}
          renderItem={renderItem}
          ListEmptyComponent={<Text style={styles.empty}>No messages yet. Tap compose to start.</Text>}
          contentContainerStyle={rows.length === 0 ? styles.emptyList : styles.listContent}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundCanvas },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: 16,
    minHeight: 64,
    backgroundColor: colors.backgroundElevated,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fontFamilies.frauncesRegular,
    fontSize: 24,
    lineHeight: 32,
    color: colors.textPrimary,
  },
  listContent: { paddingBottom: spacing['3xl'] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: spacing.xl,
    paddingVertical: 16,
    minHeight: 89,
    backgroundColor: colors.backgroundElevated,
    borderBottomWidth: 1,
    borderBottomColor: colors.backgroundMuted,
  },
  avatar: {
    width: 56,
    height: 56,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
    backgroundColor: colors.backgroundMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarText: { fontSize: fontSizes.sm, fontWeight: fontWeights.semibold, color: colors.textSecondary },
  rowMain: { flex: 1, minWidth: 0, gap: 4 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  name: {
    flex: 1,
    fontFamily: fontFamilies.frauncesRegular,
    fontSize: 16,
    lineHeight: 24,
    color: colors.textPrimary,
  },
  nameUnread: { fontFamily: fontFamilies.frauncesSemiBold },
  time: { fontSize: 12, fontStyle: 'italic', color: colors.textTag },
  preview: { fontSize: fontSizes.sm, fontWeight: fontWeights.medium, lineHeight: 20 },
  previewMuted: { color: colors.textSecondary },
  previewActive: { color: colors.textPrimary },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#a50036',
  },
  empty: {
    padding: spacing.xl,
    textAlign: 'center',
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
  },
  emptyList: { flexGrow: 1, justifyContent: 'center' },
})
