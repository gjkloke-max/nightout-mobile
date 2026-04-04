import { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Image,
  ActivityIndicator,
  DeviceEventEmitter,
} from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import {
  getNotificationsForUser,
  markAllAsRead,
  markAsRead,
  markAsSeen,
  deleteNotification,
} from '../services/notifications'
import { navigateFromNotificationMobileLink } from '../services/notificationDeepLink'
import { acceptFollowRequest, denyFollowRequest } from '../services/follows'
import { colors, fontSizes, fontWeights, spacing } from '../theme'

const LEGACY_TYPES = {
  follow_request: 'follow_request_received',
  follow_accepted: 'follow_request_accepted',
  follow_denied: 'follow_request_declined',
}

function normalizeType(t) {
  return LEGACY_TYPES[t] || t
}

function getMeta(n) {
  if (n.metadata && typeof n.metadata === 'object') return n.metadata
  return n.payload || {}
}

function isUnread(n) {
  if (n.read_at != null) return false
  if (n.is_read === true) return false
  return true
}

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

function resolveName(profile, payloadName, fallback = 'Someone') {
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
  const [loadingMore, setLoadingMore] = useState(false)
  const [nextCursor, setNextCursor] = useState(null)
  const [acting, setActing] = useState(null)

  const loadPage = useCallback(
    async (cursor = null, append = false) => {
      if (!user?.id) return
      if (append) setLoadingMore(true)
      else setLoading(true)
      try {
        const { notifications: rows, nextCursor: nc } = await getNotificationsForUser(user.id, {
          limit: 20,
          cursor,
        })
        setNotifications((prev) => (append ? [...prev, ...(rows || [])] : rows || []))
        setNextCursor(nc)
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [user?.id]
  )

  useFocusEffect(
    useCallback(() => {
      if (!user?.id) return undefined
      let cancelled = false
      ;(async () => {
        await markAsSeen(user.id, null)
        if (!cancelled) {
          DeviceEventEmitter.emit(BADGE_REFRESH)
          await loadPage(null, false)
        }
      })()
      return () => {
        cancelled = true
      }
    }, [user?.id, loadPage])
  )

  useEffect(() => {
    if (!notifications.length) return
    const ids = new Set()
    notifications.forEach((n) => {
      const t = normalizeType(n.type)
      const meta = getMeta(n)
      if (t === 'follow_request_received' && (meta.requester_user_id || n.actor_user_id)) {
        ids.add(meta.requester_user_id || n.actor_user_id)
      }
      if (
        (t === 'follow_request_accepted' || t === 'follow_request_declined') &&
        (meta.target_user_id || n.actor_user_id)
      ) {
        ids.add(meta.target_user_id || n.actor_user_id)
      }
      if (n.actor_user_id) ids.add(n.actor_user_id)
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
    const meta = getMeta(n)
    const rid = meta.requester_user_id || n.actor_user_id
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
    const meta = getMeta(n)
    const rid = meta.requester_user_id || n.actor_user_id
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
    const now = new Date().toISOString()
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true, read_at: n.read_at || now })))
  }

  const openFriendProfile = (uid) => {
    if (!uid || uid === user?.id) return
    navigation.navigate('FriendProfile', { userId: uid })
  }

  const handleGenericPress = async (n) => {
    if (!user?.id) return
    await markAsRead(n.id, user.id)
    setNotifications((prev) =>
      prev.map((x) => (x.id === n.id ? { ...x, is_read: true, read_at: x.read_at || new Date().toISOString() } : x))
    )
    const navigated = navigateFromNotificationMobileLink(navigation, n.mobile_link)
    if (!navigated && n.actor_user_id) {
      openFriendProfile(n.actor_user_id)
    }
  }

  const renderNotification = ({ item: n }) => {
    const timeStr = formatTime(n.created_at)
    const t = normalizeType(n.type)
    const meta = getMeta(n)
    const unread = isUnread(n)

    if (t === 'follow_request_received') {
      const rid = meta.requester_user_id || n.actor_user_id
      const profile = rid ? actorProfiles[rid] || null : null
      const name = resolveName(profile, meta.requester_name, 'A user')
      const avatarUrl = profile?.avatar_url || meta.requester_avatar_url || null
      const bodyLine = n.body || `${name} wants to follow you.`
      return (
        <View style={[styles.item, unread && styles.itemUnread]}>
          <Pressable style={styles.itemBody} onPress={() => rid && openFriendProfile(rid)}>
            <View style={styles.avatar}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
              ) : (
                <Text style={styles.avatarText}>{(name || 'U').slice(0, 2).toUpperCase()}</Text>
              )}
            </View>
            <View style={styles.textCol}>
              <Text style={styles.text}>{bodyLine}</Text>
              {timeStr ? <Text style={styles.time}>{timeStr}</Text> : null}
            </View>
          </Pressable>
          <View style={styles.actions}>
            <Pressable style={styles.acceptBtn} onPress={() => handleAccept(n)} disabled={acting === n.id}>
              {acting === n.id ? (
                <ActivityIndicator size="small" color={colors.textOnDark} />
              ) : (
                <Text style={styles.acceptBtnText}>Accept</Text>
              )}
            </Pressable>
            <Pressable style={styles.denyBtn} onPress={() => handleDeny(n)} disabled={acting === n.id}>
              <Text style={styles.denyBtnText}>Deny</Text>
            </Pressable>
          </View>
        </View>
      )
    }

    if (t === 'follow_request_accepted') {
      const tid = meta.target_user_id || n.actor_user_id
      const profile = tid ? actorProfiles[tid] || null : null
      const name = resolveName(profile, meta.target_name, 'They')
      const avatarUrl = profile?.avatar_url || meta.target_avatar_url || null
      const bodyLine = n.body || `${name} accepted your follow request.`
      return (
        <Pressable
          style={[styles.itemRow, unread && styles.itemUnread]}
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
            <Text style={styles.text}>{bodyLine}</Text>
            {timeStr ? <Text style={styles.time}>{timeStr}</Text> : null}
          </View>
        </Pressable>
      )
    }

    if (t === 'follow_request_declined') {
      const tid = meta.target_user_id || n.actor_user_id
      const profile = tid ? actorProfiles[tid] || null : null
      const name = resolveName(profile, meta.target_name, 'They')
      const avatarUrl = profile?.avatar_url || meta.target_avatar_url || null
      const bodyLine = n.body || `${name} declined your follow request.`
      return (
        <Pressable
          style={[styles.itemRow, unread && styles.itemUnread]}
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
            <Text style={styles.text}>{bodyLine}</Text>
            {timeStr ? <Text style={styles.time}>{timeStr}</Text> : null}
          </View>
        </Pressable>
      )
    }

    const aid = n.actor_user_id
    const profile = aid ? actorProfiles[aid] || null : null
    const fallbackName = resolveName(profile, meta.actor_display_name || meta.requester_name, '')
    const avatarUrl = profile?.avatar_url || n.image_url || null
    const bodyLine = n.body || normalizeType(n.type).replace(/_/g, ' ')
    return (
      <Pressable style={[styles.itemRow, unread && styles.itemUnread]} onPress={() => handleGenericPress(n)}>
        <View style={styles.avatar}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
          ) : (
            <Text style={styles.avatarText}>{(fallbackName || '?').slice(0, 2).toUpperCase()}</Text>
          )}
        </View>
        <View style={styles.textCol}>
          <Text style={styles.text}>{bodyLine}</Text>
          {timeStr ? <Text style={styles.time}>{timeStr}</Text> : null}
        </View>
      </Pressable>
    )
  }

  const unreadCount = notifications.filter((n) => isUnread(n)).length

  const onEndReached = () => {
    if (!nextCursor || loadingMore || loading) return
    loadPage(nextCursor, true)
  }

  return (
    <View style={styles.container}>
      {unreadCount > 0 ? (
        <Pressable style={styles.markAll} onPress={handleMarkAllRead}>
          <Text style={styles.markAllText}>Mark all read</Text>
        </Pressable>
      ) : null}
      {loading && notifications.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.profileAccent} />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Notifications</Text>
          <Text style={styles.emptySubtitle}>
            Follow requests, likes, and comments will appear here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderNotification}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoad}>
                <ActivityIndicator color={colors.profileAccent} />
              </View>
            ) : null
          }
          contentContainerStyle={styles.scrollContent}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  markAll: { padding: spacing.base, alignItems: 'flex-end' },
  markAllText: { fontSize: fontSizes.sm, color: colors.profileAccent, fontWeight: fontWeights.semibold },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  emptyTitle: { fontSize: fontSizes.xl, fontWeight: fontWeights.semibold, color: colors.textPrimary, marginBottom: spacing.sm },
  emptySubtitle: { fontSize: fontSizes.sm, color: colors.textSecondary, textAlign: 'center' },
  scrollContent: { paddingBottom: spacing['3xl'] },
  footerLoad: { padding: spacing.lg, alignItems: 'center' },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  itemUnread: { backgroundColor: 'rgba(157, 23, 77, 0.08)' },
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
  time: { fontSize: fontSizes.xs, color: colors.textMuted, marginTop: 2 },
  actions: { flexDirection: 'row', gap: spacing.sm },
  acceptBtn: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: 6,
    backgroundColor: colors.profileAccent,
    minWidth: 70,
    alignItems: 'center',
  },
  acceptBtnText: { fontSize: fontSizes.sm, color: colors.textOnDark, fontWeight: fontWeights.semibold },
  denyBtn: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: 6,
    backgroundColor: colors.backgroundElevated,
    borderWidth: 2,
    borderColor: colors.textPrimary,
  },
  denyBtnText: { fontSize: fontSizes.sm, color: colors.textPrimary, fontWeight: fontWeights.semibold },
})
