import { useCallback, useEffect, useState } from 'react'
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image } from 'react-native'
import { useNavigation, useFocusEffect } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ChevronLeft } from 'lucide-react-native'
import { useAuth } from '../contexts/AuthContext'
import { listSuggestedDmUsers, getOrCreateDirectConversation, displayNameFromProfile } from '../services/messaging'
import { colors, fontFamilies, fontSizes, fontWeights, spacing, borderRadius } from '../theme'

export default function DMNewMessageScreen() {
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [opening, setOpening] = useState(null)

  const load = useCallback(() => {
    if (!user?.id) return
    listSuggestedDmUsers(user.id)
      .then(setUsers)
      .finally(() => setLoading(false))
  }, [user?.id])

  useFocusEffect(
    useCallback(() => {
      setLoading(true)
      load()
    }, [load])
  )

  const openThread = async (otherId) => {
    if (!otherId || opening) return
    setOpening(otherId)
    try {
      const convId = await getOrCreateDirectConversation(otherId)
      navigation.replace('DMConversation', { conversationId: convId })
    } catch (e) {
      console.warn(e)
      setOpening(null)
    }
  }

  const renderItem = ({ item: p }) => {
    const name = displayNameFromProfile(p)
    const initials = name
      .split(/\s+/)
      .map((s) => s[0])
      .join('')
      .slice(0, 2)
      .toUpperCase()
    return (
      <TouchableOpacity
        style={styles.row}
        disabled={opening === p.id}
        onPress={() => openThread(p.id)}
        activeOpacity={0.85}
      >
        <View style={styles.avatar}>
          {p.avatar_url ? <Image source={{ uri: p.avatar_url }} style={styles.avatarImg} /> : <Text style={styles.avatarText}>{initials}</Text>}
        </View>
        <Text style={styles.name}>{name}</Text>
      </TouchableOpacity>
    )
  }

  return (
    <View style={[styles.container, { paddingTop: Math.max(spacing.lg, insets.top) }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn} hitSlop={12} accessibilityLabel="Back">
          <ChevronLeft size={24} color={colors.textPrimary} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New message</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <Text style={styles.empty}>Loading…</Text>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(u) => u.id}
          renderItem={renderItem}
          ListEmptyComponent={<Text style={styles.empty}>Follow people first to message them from here.</Text>}
          contentContainerStyle={users.length === 0 ? styles.emptyList : styles.listContent}
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
    paddingVertical: 14,
    backgroundColor: colors.backgroundElevated,
    borderBottomWidth: 1,
    borderBottomColor: colors.backgroundMuted,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    backgroundColor: colors.backgroundMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarText: { fontSize: fontSizes.sm, fontWeight: fontWeights.semibold, color: colors.textSecondary },
  name: {
    fontFamily: fontFamilies.frauncesRegular,
    fontSize: fontSizes.base,
    lineHeight: 24,
    color: colors.textPrimary,
  },
  empty: {
    padding: spacing.xl,
    textAlign: 'center',
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
  },
  emptyList: { flexGrow: 1, justifyContent: 'center' },
})
