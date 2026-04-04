import { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  ActivityIndicator,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { getNotifications, markAllAsRead, deleteNotification } from '../services/notifications'
import { acceptFollowRequest, denyFollowRequest } from '../services/follows'
import { colors, fontSizes, fontWeights, spacing } from '../theme'

function displayName(p) {
  if (!p) return null
  const parts = [p.first_name, p.last_name].filter(Boolean)
  return parts.length ? parts.join(' ') : null
}

function formatTime(createdAt) {
  if (!createdAt) return ''
  const date = new Date(createdAt)
  const now = new Date()
  const diffMins = Math.floor((now - date) / 60000)
  const diffHours = Math.floor((now - date) / 3600000)
  const diffDays = Math.floor((now - date) / 86400000)
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function resolveName(profile, payloadName, fallback = 'A user') {
  const fromProfile = displayName(profile)
  if (fromProfile) return fromProfile
  if (payloadName && payloadName !== 'A user' && payloadName !== 'They') return payloadName
  return fallback
}

export default function NotificationsScreen() {
  const navigation = useNavigation()
  const { user } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [actorProfiles, setActorProfiles] = useState({})
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(null)

  const loadNotifications = async () => {
    if (!user?.id) return
    const data = await getNotifications(user.id, 30)
    setNotifications(data || [])
  }

  useEffect(() => {
    loadNotifications().finally(() => setLoading(false))
  }, [user?.id])

  useEffect(() => {
    if (!notifications.length) return
    const ids = new Set()
    notifications.forEach((n) => {
      if (n.type === 'follow_request' && n.payload?.requester_user_id) ids.add(n.payload.requester_user_id)
      if ((n.type === 'follow_accepted' || n.type === 'follow_denied') && n.payload?.target_user_id) ids.add(n.payload.target_user_id)
    })
    if (ids.size === 0) return
    supabase
      .from('profiles')
      .select('id, first_name, last_name, avatar_url')
      .in('id', [...ids])
      .then(({ data }) => {
        setActorProfiles(Object.fromEntries((data || []).map((p) => [p.id, p])))
      })
  }, [notifications])

  const handleAccept = async (n) => {
    const rid = n.payload?.requester_user_id
    if (!rid) return
    setActing(n.id)
    try {
      await acceptFollowRequest(user.id, rid)
      await deleteNotification(n.id, user.id)
      setNotifications((prev) => prev.filter((x) => x.id !== n.id))
    } finally {
      setActing(null)
    }
  }

  const handleDeny = async (n) => {
    const rid = n.payload?.requester_user_id
    if (!rid) return
    setActing(n.id)
    try {
      await denyFollowRequest(user.id, rid)
      await deleteNotification(n.id, user.id)
      setNotifications((prev) => prev.filter((x) => x.id !== n.id))
    } finally {
      setActing(null)
    }
  }

  const handleMarkAllRead = async () => {
    if (!user?.id) return
    await markAllAsRead(user.id)
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length

  const openFriendProfile = (uid) => {
    if (!uid || uid === user?.id) return
    navigation.navigate('FriendProfile', { userId: uid })
  }

  const renderNotification = (n) => {
    const timeStr = formatTime(n.created_at)

    if (n.type === 'follow_request') {
      const rid = n.payload?.requester_user_id
      const profile = actorProfiles[rid] || null
      const name = resolveName(profile, n.payload?.requester_name, 'A user')
      const avatarUrl = profile?.avatar_url || n.payload?.requester_avatar_url || null
      return (
        <View key={n.id} style={[styles.item, !n.is_read && styles.itemUnread]}>
          <Pressable style={styles.itemBody} onPress={() => rid && openFriendProfile(rid)}>
            <View style={styles.avatar}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
              ) : (
                <Text style={styles.avatarText}>{(name || 'U').slice(0, 2).toUpperCase()}</Text>
              )}
            </View>
            <View style={styles.textCol}>
              <Text style={styles.text}><Text style={styles.bold}>{name}</Text> wants to follow you.</Text>
              {timeStr ? <Text style={styles.time}>{timeStr}</Text> : null}
            </View>
          </Pressable>
          <View style={styles.actions}>
            <Pressable style={styles.acceptBtn} onPress={() => handleAccept(n)} disabled={acting === n.id}>
              {acting === n.id ? <ActivityIndicator size="small" color={colors.textOnDark} /> : <Text style={styles.acceptBtnText}>Accept</Text>}
            </Pressable>
            <Pressable style={styles.denyBtn} onPress={() => handleDeny(n)} disabled={acting === n.id}>
              <Text style={styles.denyBtnText}>Deny</Text>
            </Pressable>
          </View>
        </View>
      )
    }
    if (n.type === 'follow_accepted') {
      const tid = n.payload?.target_user_id
      const profile = actorProfiles[tid] || null
      const name = resolveName(profile, n.payload?.target_name, 'They')
      const avatarUrl = profile?.avatar_url || n.payload?.target_avatar_url || null
      return (
        <Pressable
          key={n.id}
          style={[styles.item, !n.is_read && styles.itemUnread]}
          onPress={() => tid && openFriendProfile(tid)}
        >
          <View style={styles.avatar}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
            ) : (
              <Text style={styles.avatarText}>{(name || 'T').slice(0, 2).toUpperCase()}</Text>
            )}
          </View>
          <View style={styles.textCol}>
            <Text style={styles.text}><Text style={styles.bold}>{name}</Text> accepted your follow request.</Text>
            {timeStr ? <Text style={styles.time}>{timeStr}</Text> : null}
          </View>
        </Pressable>
      )
    }
    if (n.type === 'follow_denied') {
      const tid = n.payload?.target_user_id
      const profile = actorProfiles[tid] || null
      const name = resolveName(profile, n.payload?.target_name, 'They')
      const avatarUrl = profile?.avatar_url || n.payload?.target_avatar_url || null
      return (
        <Pressable
          key={n.id}
          style={[styles.item, !n.is_read && styles.itemUnread]}
          onPress={() => tid && openFriendProfile(tid)}
        >
          <View style={styles.avatar}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
            ) : (
              <Text style={styles.avatarText}>{(name || 'T').slice(0, 2).toUpperCase()}</Text>
            )}
          </View>
          <View style={styles.textCol}>
            <Text style={styles.text}><Text style={styles.bold}>{name}</Text> declined your follow request.</Text>
            {timeStr ? <Text style={styles.time}>{timeStr}</Text> : null}
          </View>
        </Pressable>
      )
    }
    return null
  }

  return (
    <View style={styles.container}>
      {unreadCount > 0 ? (
        <Pressable style={styles.markAll} onPress={handleMarkAllRead}>
          <Text style={styles.markAllText}>Mark all read</Text>
        </Pressable>
      ) : null}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Notifications</Text>
          <Text style={styles.emptySubtitle}>
            Follow requests, likes, and comments will appear here.
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {notifications.map(renderNotification)}
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  markAll: { padding: spacing.base, alignItems: 'flex-end' },
  markAllText: { fontSize: fontSizes.sm, color: colors.link },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  emptyTitle: { fontSize: fontSizes.xl, fontWeight: fontWeights.semibold, color: colors.textPrimary, marginBottom: spacing.sm },
  emptySubtitle: { fontSize: fontSizes.sm, color: colors.textSecondary, textAlign: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.base, paddingBottom: spacing['3xl'] },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  itemUnread: { backgroundColor: colors.accentMuted },
  itemBody: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarText: { fontSize: fontSizes.sm, color: colors.textMuted },
  textCol: { flex: 1, marginLeft: spacing.md },
  text: { fontSize: fontSizes.sm, color: colors.textPrimary },
  bold: { fontWeight: fontWeights.semibold },
  time: { fontSize: fontSizes.xs, color: colors.textMuted, marginTop: 2 },
  actions: { flexDirection: 'row', gap: spacing.sm },
  acceptBtn: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    backgroundColor: colors.accent,
    minWidth: 70,
    alignItems: 'center',
  },
  acceptBtnText: { fontSize: fontSizes.sm, color: colors.textOnDark, fontWeight: '600' },
  denyBtn: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  denyBtnText: { fontSize: fontSizes.sm, color: colors.textPrimary },
})
