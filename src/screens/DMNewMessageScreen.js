import { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
} from 'react-native'
import { useNavigation, useFocusEffect } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ChevronLeft, Search } from 'lucide-react-native'
import { useAuth } from '../contexts/AuthContext'
import { useDebounce } from '../hooks/useDebounce'
import { searchUsers } from '../services/userSearch'
import { listSuggestedDmUsers, getOrCreateDirectConversation, displayNameFromProfile } from '../services/messaging'
import { colors, fontFamilies, fontSizes, fontWeights, spacing, textStyles } from '../theme'

export default function DMNewMessageScreen() {
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const [suggested, setSuggested] = useState([])
  const [searchResults, setSearchResults] = useState([])
  const [loadingSuggested, setLoadingSuggested] = useState(true)
  const [searchLoading, setSearchLoading] = useState(false)
  const [opening, setOpening] = useState(null)

  const debouncedQuery = useDebounce(query.trim(), 300)
  const isSearching = debouncedQuery.length >= 2

  const loadSuggested = useCallback(() => {
    if (!user?.id) return
    listSuggestedDmUsers(user.id).then(setSuggested).finally(() => setLoadingSuggested(false))
  }, [user?.id])

  useFocusEffect(
    useCallback(() => {
      setLoadingSuggested(true)
      loadSuggested()
    }, [loadSuggested])
  )

  useEffect(() => {
    if (!user?.id || !isSearching) {
      setSearchResults([])
      setSearchLoading(false)
      return
    }
    let cancelled = false
    setSearchLoading(true)
    searchUsers(user.id, debouncedQuery)
      .then((data) => {
        if (!cancelled) setSearchResults(data || [])
      })
      .finally(() => {
        if (!cancelled) setSearchLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [user?.id, debouncedQuery, isSearching])

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

  const list = isSearching ? searchResults : suggested
  const showSuggested = !isSearching && !loadingSuggested
  const emptySearch = isSearching && !searchLoading && searchResults.length === 0
  const emptySuggested = showSuggested && suggested.length === 0

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

  const listHeader = showSuggested ? <Text style={[textStyles.sectionLabel, styles.sectionLabelPad]}>Suggested</Text> : null

  return (
    <View style={[styles.container, { paddingTop: Math.max(spacing.lg, insets.top) }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn} hitSlop={12} accessibilityLabel="Back">
          <ChevronLeft size={24} color={colors.textPrimary} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New message</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.searchSection}>
        <View style={styles.searchRow}>
          <Search size={18} color={colors.borderInput} strokeWidth={2} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search people…"
            placeholderTextColor={colors.textTag}
            autoCorrect={false}
            autoCapitalize="none"
          />
        </View>
      </View>

      {loadingSuggested && !isSearching ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.browseAccent} />
          <Text style={styles.muted}>Loading…</Text>
        </View>
      ) : searchLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.browseAccent} />
          <Text style={styles.muted}>Searching…</Text>
        </View>
      ) : emptySearch ? (
        <Text style={styles.empty}>No users found.</Text>
      ) : emptySuggested ? (
        <Text style={styles.empty}>Follow people to see them here, or search by name.</Text>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(u) => u.id}
          renderItem={renderItem}
          ListHeaderComponent={listHeader}
          contentContainerStyle={styles.listContent}
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
  searchSection: {
    paddingHorizontal: spacing.xl,
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: colors.backgroundCanvas,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 10,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: colors.borderInput,
  },
  searchInput: {
    flex: 1,
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.sm,
    color: colors.textPrimary,
    paddingVertical: 0,
  },
  sectionLabelPad: {
    marginHorizontal: spacing.xl,
    marginBottom: 8,
    marginTop: 4,
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
    borderRadius: 24,
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  muted: { fontSize: fontSizes.sm, color: colors.textMuted },
})
