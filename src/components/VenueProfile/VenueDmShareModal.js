import { useEffect, useState } from 'react'
import {
  View,
  Text,
  Modal,
  TextInput,
  Pressable,
  FlatList,
  Image,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { X, Search, Send } from 'lucide-react-native'
import { useAuth } from '../../contexts/AuthContext'
import { useDebounce } from '../../hooks/useDebounce'
import { searchUsers } from '../../services/userSearch'
import {
  listSuggestedDmUsers,
  getOrCreateDirectConversation,
  sendMessage,
  displayNameFromProfile,
  formatDmHandle,
} from '../../services/messaging'
import DmVenueShareCard from '../dm/DmVenueShareCard'
import { buildVenueShareSnapshot, serializeVenueShareDm } from '../../utils/dmVenueShareMessage'
import { colors, fontFamilies, fontSizes, spacing } from '../../theme'

function profileRowHandle(p) {
  const u = (p?.username || '').trim()
  if (u) return u.startsWith('@') ? u : `@${u}`
  return formatDmHandle(p) || ''
}

function profileInitials(p) {
  const n = displayNameFromProfile(p)
  return n
    .split(/\s+/)
    .map((s) => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export default function VenueDmShareModal({ visible, venue, onClose, navigation }) {
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const [suggested, setSuggested] = useState([])
  const [searchResults, setSearchResults] = useState([])
  const [loadingSuggested, setLoadingSuggested] = useState(true)
  const [searchLoading, setSearchLoading] = useState(false)
  const [recipient, setRecipient] = useState(null)
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)

  const debouncedQuery = useDebounce(query.trim(), 300)
  const isSearching = debouncedQuery.length >= 2
  const venueName = venue?.name || 'this place'

  useEffect(() => {
    if (!visible || !user?.id) return
    setQuery('')
    setRecipient(null)
    setNote('')
    setError(null)
    setLoadingSuggested(true)
    listSuggestedDmUsers(user.id).then(setSuggested).finally(() => setLoadingSuggested(false))
  }, [visible, user?.id])

  useEffect(() => {
    if (!visible || !user?.id || !isSearching) {
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
  }, [visible, user?.id, debouncedQuery, isSearching])

  const pickRecipient = (p) => {
    setRecipient(p)
    setQuery('')
    setSearchResults([])
    setError(null)
  }

  const handleSend = async () => {
    if (!recipient?.id || sending || !venue?.venue_id) return
    setSending(true)
    setError(null)
    try {
      const body = serializeVenueShareDm(venue, note)
      const convId = await getOrCreateDirectConversation(recipient.id)
      await sendMessage(convId, body)
      onClose?.()
      navigation?.navigate?.('DMConversation', { conversationId: convId })
    } catch (e) {
      setError(e?.message || 'Could not send')
    } finally {
      setSending(false)
    }
  }

  const list = isSearching ? searchResults : suggested
  const snapshot = buildVenueShareSnapshot(venue)

  const renderFriendRow = ({ item }) => (
    <Pressable style={styles.friendRow} onPress={() => pickRecipient(item)}>
      <View style={styles.friendAvatar}>
        {item.avatar_url ? (
          <Image source={{ uri: item.avatar_url }} style={styles.friendAvatarImg} />
        ) : (
          <Text style={styles.friendAvatarTxt}>{profileInitials(item)}</Text>
        )}
      </View>
      <View style={styles.friendText}>
        <Text style={styles.friendName} numberOfLines={1}>
          {displayNameFromProfile(item)}
        </Text>
        {profileRowHandle(item) ? (
          <Text style={styles.friendHandle} numberOfLines={1}>
            {profileRowHandle(item)}
          </Text>
        ) : null}
      </View>
      <Send size={16} color={colors.textSecondary} strokeWidth={2} />
    </Pressable>
  )

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.root, { paddingTop: insets.top, paddingBottom: recipient ? 0 : Math.max(spacing.md, insets.bottom) }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={styles.title}>Send to Friend</Text>
            <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close">
              <X size={20} color={colors.textPrimary} strokeWidth={2} />
            </Pressable>
          </View>
          <Text style={styles.subtitle}>Share {venueName} with your friends</Text>
        </View>

        {!recipient ? (
          <>
            <View style={styles.searchBlock}>
              <View style={styles.searchInner}>
                <Search size={16} color={colors.textSecondary} strokeWidth={2} style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search friends..."
                  placeholderTextColor={colors.textTag}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>
            {loadingSuggested || searchLoading ? (
              <ActivityIndicator style={styles.loader} color={colors.browseAccent} />
            ) : (
              <FlatList
                data={list}
                keyExtractor={(item) => item.id}
                style={styles.friendList}
                contentContainerStyle={styles.friendListContent}
                keyboardShouldPersistTaps="handled"
                ItemSeparatorComponent={() => <View style={styles.friendSep} />}
                ListEmptyComponent={
                  <Text style={styles.hint}>{isSearching ? 'No users found.' : 'No suggested people yet.'}</Text>
                }
                renderItem={renderFriendRow}
              />
            )}
          </>
        ) : (
          <>
            <ScrollView
              style={styles.composeScroll}
              contentContainerStyle={styles.composeScrollContent}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.recipientCard}>
                <View style={styles.recipientAvatar}>
                  {recipient.avatar_url ? (
                    <Image source={{ uri: recipient.avatar_url }} style={styles.recipientAvatarImg} />
                  ) : (
                    <Text style={styles.recipientAvatarTxt}>{profileInitials(recipient)}</Text>
                  )}
                </View>
                <View style={styles.recipientMeta}>
                  <Text style={styles.recipientLabel}>Sending to</Text>
                  <Text style={styles.recipientName} numberOfLines={1}>
                    {displayNameFromProfile(recipient)}
                  </Text>
                </View>
                <Pressable onPress={() => setRecipient(null)} hitSlop={8}>
                  <Text style={styles.change}>Change</Text>
                </Pressable>
              </View>

              {snapshot ? <DmVenueShareCard snapshot={snapshot} variant="sheet" /> : null}

              <View style={styles.messageBlock}>
                <Text style={styles.messageLabel}>Add a message (optional)</Text>
                <TextInput
                  style={styles.note}
                  value={note}
                  onChangeText={setNote}
                  placeholder="Say something about this place..."
                  placeholderTextColor={colors.textTag}
                  multiline
                  textAlignVertical="top"
                />
              </View>
              {error ? <Text style={styles.err}>{error}</Text> : null}
            </ScrollView>

            <View style={[styles.footer, { paddingBottom: Math.max(16, insets.bottom) }]}>
              <Pressable style={styles.backBtn} onPress={() => setRecipient(null)}>
                <Text style={styles.backBtnText}>Back</Text>
              </Pressable>
              <Pressable
                style={[styles.sendBtn, sending && styles.sendBtnDisabled]}
                onPress={handleSend}
                disabled={sending}
              >
                <Send size={14} color="#fff" strokeWidth={2} />
                <Text style={styles.sendBtnText}>{sending ? 'Sending…' : 'Send'}</Text>
              </Pressable>
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.backgroundCanvas,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: 20,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 32,
  },
  title: {
    fontFamily: fontFamilies.frauncesRegular,
    fontSize: fontSizes.xl,
    lineHeight: 28,
    color: colors.textPrimary,
  },
  subtitle: {
    marginTop: 8,
    fontFamily: fontFamilies.frauncesItalic,
    fontSize: fontSizes.xs,
    lineHeight: 16,
    color: colors.textSecondary,
  },
  searchBlock: {
    paddingHorizontal: spacing.xl,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  searchInner: {
    position: 'relative',
    justifyContent: 'center',
  },
  searchIcon: {
    position: 'absolute',
    left: 12,
    zIndex: 1,
  },
  searchInput: {
    height: 41,
    paddingLeft: 40,
    paddingRight: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.borderInput,
    backgroundColor: colors.backgroundElevated,
    fontFamily: fontFamilies.inter,
    fontSize: fontSizes.sm,
    color: colors.textPrimary,
  },
  friendList: { flex: 1 },
  friendListContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: 24,
    paddingBottom: spacing.xl,
    flexGrow: 1,
  },
  friendSep: { height: 8 },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 73,
    paddingVertical: 12,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.backgroundElevated,
  },
  friendAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: 'hidden',
    backgroundColor: colors.backgroundMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendAvatarImg: { width: '100%', height: '100%' },
  friendAvatarTxt: {
    fontFamily: fontFamilies.interSemiBold,
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
  },
  friendText: { flex: 1, minWidth: 0 },
  friendName: {
    fontFamily: fontFamilies.frauncesRegular,
    fontSize: fontSizes.base,
    lineHeight: 24,
    color: colors.textPrimary,
  },
  friendHandle: {
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.xs,
    lineHeight: 16,
    color: colors.textSecondary,
  },
  loader: { marginVertical: spacing.xl },
  hint: { fontSize: fontSizes.sm, color: colors.textMuted, paddingVertical: spacing.md },
  composeScroll: { flex: 1 },
  composeScrollContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: 24,
    paddingBottom: spacing.lg,
    gap: 16,
  },
  recipientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.backgroundElevated,
  },
  recipientAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: 'hidden',
    backgroundColor: colors.backgroundMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recipientAvatarImg: { width: '100%', height: '100%' },
  recipientAvatarTxt: {
    fontFamily: fontFamilies.interSemiBold,
    fontSize: 11,
    color: colors.textSecondary,
  },
  recipientMeta: { flex: 1, minWidth: 0 },
  recipientLabel: {
    fontFamily: fontFamilies.interBold,
    fontSize: fontSizes.micro,
    lineHeight: 15,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  recipientName: {
    marginTop: 2,
    fontFamily: fontFamilies.frauncesRegular,
    fontSize: fontSizes.sm,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  change: {
    fontFamily: fontFamilies.interBold,
    fontSize: fontSizes.xs,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  messageBlock: { gap: 8 },
  messageLabel: {
    fontFamily: fontFamilies.interBold,
    fontSize: fontSizes.micro,
    lineHeight: 15,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: '#3f3f47',
  },
  note: {
    minHeight: 97,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.borderInput,
    backgroundColor: colors.backgroundElevated,
    fontFamily: fontFamilies.inter,
    fontSize: fontSizes.base,
    lineHeight: 24,
    color: colors.textPrimary,
  },
  err: { color: colors.error, fontSize: fontSizes.sm },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: spacing.xl,
    paddingTop: 16,
    backgroundColor: colors.backgroundElevated,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  backBtn: {
    flex: 1,
    minHeight: 45,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderInput,
    backgroundColor: colors.backgroundElevated,
  },
  backBtnText: {
    fontFamily: fontFamilies.interBold,
    fontSize: fontSizes.xs,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.textPrimary,
  },
  sendBtn: {
    flex: 1,
    minHeight: 45,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.textPrimary,
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText: {
    fontFamily: fontFamilies.interBold,
    fontSize: fontSizes.xs,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: '#fff',
  },
})
