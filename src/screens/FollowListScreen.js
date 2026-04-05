import { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Image,
  ActivityIndicator,
} from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ChevronLeft } from 'lucide-react-native'
import { useAuth } from '../contexts/AuthContext'
import { getFollowers, getFollowing } from '../services/follows'
import { colors, fontSizes, fontFamilies, spacing } from '../theme'

function displayName(p) {
  if (!p) return 'Anonymous'
  const parts = [p.first_name, p.last_name].filter(Boolean)
  return parts.length ? parts.join(' ') : 'Anonymous'
}

export default function FollowListScreen() {
  const navigation = useNavigation()
  const route = useRoute()
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const userId = route.params?.userId
  const mode = route.params?.mode === 'following' ? 'following' : 'followers'

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      const data = mode === 'following' ? await getFollowing(userId, 200) : await getFollowers(userId, 200)
      setRows(data || [])
    } catch (e) {
      console.error(e)
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [userId, mode])

  useEffect(() => {
    load()
  }, [load])

  const title = mode === 'following' ? 'Following' : 'Followers'

  const openProfile = (uid) => {
    if (!uid || uid === user?.id) {
      navigation.navigate('MainTabs', { screen: 'Profile' })
      return
    }
    navigation.navigate('FriendProfile', { userId: uid })
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={12}>
          <ChevronLeft size={22} color={colors.textPrimary} strokeWidth={2} />
          <Text style={styles.backText}>BACK</Text>
        </Pressable>
        <Text style={styles.title}>{title}</Text>
        <View style={{ width: 72 }} />
      </View>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.browseAccent} />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => String(item.userId)}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<Text style={styles.empty}>No users yet.</Text>}
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => openProfile(item.userId)}>
              <View style={styles.avatar}>
                {item.profile?.avatar_url ? (
                  <Image source={{ uri: item.profile.avatar_url }} style={styles.avatarImg} />
                ) : (
                  <Text style={styles.avatarText}>{displayName(item.profile).slice(0, 2).toUpperCase()}</Text>
                )}
              </View>
              <Text style={styles.name} numberOfLines={1}>
                {displayName(item.profile)}
              </Text>
            </Pressable>
          )}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.backgroundCanvas },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: { fontSize: 11, fontFamily: fontFamilies.interBold, letterSpacing: 1 },
  title: { fontSize: fontSizes.lg, fontFamily: fontFamilies.fraunces, color: colors.textPrimary },
  listContent: { paddingBottom: spacing['3xl'] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarText: { fontSize: 12, fontFamily: fontFamilies.interBold, color: colors.textSecondary },
  name: { flex: 1, fontSize: fontSizes.md, fontFamily: fontFamilies.fraunces, color: colors.textPrimary },
  empty: { textAlign: 'center', color: colors.textSecondary, marginTop: spacing.xl, paddingHorizontal: spacing.xl },
})
