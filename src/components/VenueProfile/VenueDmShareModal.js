import { useCallback, useEffect, useState } from 'react'
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
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { X } from 'lucide-react-native'
import { useAuth } from '../../contexts/AuthContext'
import { useDebounce } from '../../hooks/useDebounce'
import { searchUsers } from '../../services/userSearch'
import {
  listSuggestedDmUsers,
  getOrCreateDirectConversation,
  sendMessage,
  displayNameFromProfile,
} from '../../services/messaging'
import { getVenueWebUrl } from '../../utils/venueShare'
import { colors, fontFamilies, fontSizes, spacing } from '../../theme'

function thumb(venue) {
  if (Array.isArray(venue?.photo_urls) && venue.photo_urls[0]) return venue.photo_urls[0]
  return venue?.primary_photo_url || null
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

  const buildBody = useCallback(() => {
    const name = venue?.name || 'Venue'
    const url = venue?.venue_id ? getVenueWebUrl(venue.venue_id) : ''
    const lines = [name, url].filter(Boolean)
    if (note.trim()) lines.push('', note.trim())
    return lines.join('\n')
  }, [venue, note])

  const handleSend = async () => {
    if (!recipient?.id || sending) return
    const body = buildBody().trim()
    if (!body) return
    setSending(true)
    setError(null)
    try {
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
  const showPicker = !recipient

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.root, { paddingTop: insets.top }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.head}>
          <Text style={styles.title}>Send venue</Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close">
            <X size={24} color={colors.textSecondary} strokeWidth={2} />
          </Pressable>
        </View>

        <View style={styles.card}>
          {thumb(venue) ? (
            <Image source={{ uri: thumb(venue) }} style={styles.cardImg} />
          ) : (
            <View style={[styles.cardImg, styles.cardImgEmpty]} />
          )}
          <View style={styles.cardBody}>
            <Text style={styles.cardName} numberOfLines={2}>
              {venue?.name || 'Venue'}
            </Text>
            {venue?.neighborhood_name ? (
              <Text style={styles.cardHood}>{String(venue.neighborhood_name).toUpperCase()}</Text>
            ) : null}
          </View>
        </View>

        {showPicker ? (
          <>
            <Text style={styles.label}>To</Text>
            <TextInput
              style={styles.search}
              value={query}
              onChangeText={setQuery}
              placeholder="Search people…"
              placeholderTextColor={colors.textTag}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {loadingSuggested || searchLoading ? (
              <ActivityIndicator style={styles.loader} color={colors.browseAccent} />
            ) : (
              <FlatList
                data={list}
                keyExtractor={(item) => item.id}
                style={styles.list}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={<Text style={styles.hint}>{isSearching ? 'No users found.' : 'No suggested people.'}</Text>}
                renderItem={({ item }) => (
                  <Pressable style={styles.row} onPress={() => setRecipient(item)}>
                    <Text style={styles.rowName}>{displayNameFromProfile(item)}</Text>
                  </Pressable>
                )}
              />
            )}
          </>
        ) : (
          <>
            <View style={styles.toRow}>
              <Text style={styles.toLine}>
                To: <Text style={styles.toStrong}>{displayNameFromProfile(recipient)}</Text>
              </Text>
              <Pressable onPress={() => setRecipient(null)} hitSlop={8}>
                <Text style={styles.change}>Change</Text>
              </Pressable>
            </View>
            <Text style={styles.label}>Message (optional)</Text>
            <TextInput
              style={styles.note}
              value={note}
              onChangeText={setNote}
              placeholder="Add a note…"
              placeholderTextColor={colors.textTag}
              multiline
            />
            {error ? <Text style={styles.err}>{error}</Text> : null}
            <Pressable
              style={[styles.sendBtn, sending && styles.sendBtnDisabled]}
              onPress={handleSend}
              disabled={sending}
            >
              <Text style={styles.sendBtnText}>{sending ? 'Sending…' : 'Send'}</Text>
            </Pressable>
          </>
        )}
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.backgroundCanvas, paddingHorizontal: spacing.xl, paddingBottom: spacing.xl },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  title: { fontSize: fontSizes.lg, fontFamily: fontFamilies.frauncesSemiBold, color: colors.textPrimary },
  card: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    backgroundColor: colors.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: spacing.lg,
  },
  cardImg: { width: 72, height: 72, backgroundColor: colors.backgroundDark },
  cardImgEmpty: { backgroundColor: colors.borderInput },
  cardBody: { flex: 1, justifyContent: 'center' },
  cardName: { fontSize: fontSizes.base, fontFamily: fontFamilies.frauncesSemiBold, color: colors.textPrimary },
  cardHood: {
    marginTop: 4,
    fontSize: 10,
    fontFamily: fontFamilies.interBold,
    letterSpacing: 0.8,
    color: colors.textSecondary,
  },
  label: {
    fontSize: 10,
    fontFamily: fontFamilies.interBold,
    letterSpacing: 1,
    color: colors.textTag,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
  },
  search: {
    borderWidth: 1,
    borderColor: colors.borderInput,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: fontSizes.sm,
    fontFamily: fontFamilies.inter,
    marginBottom: spacing.sm,
  },
  list: { maxHeight: 220 },
  row: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderLight },
  rowName: { fontSize: fontSizes.sm, fontFamily: fontFamilies.inter, color: colors.textPrimary },
  hint: { fontSize: fontSizes.sm, color: colors.textMuted, paddingVertical: spacing.md },
  loader: { marginVertical: spacing.lg },
  toRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  toLine: { flex: 1, fontSize: fontSizes.sm, fontFamily: fontFamilies.inter, color: colors.textPrimary },
  toStrong: { fontFamily: fontFamilies.interBold },
  change: { fontSize: fontSizes.sm, color: colors.browseAccent, textDecorationLine: 'underline' },
  note: {
    borderWidth: 1,
    borderColor: colors.borderInput,
    borderRadius: 8,
    padding: 12,
    minHeight: 80,
    textAlignVertical: 'top',
    fontSize: fontSizes.sm,
    fontFamily: fontFamilies.inter,
    marginBottom: spacing.md,
  },
  err: { color: colors.error, marginBottom: spacing.sm, fontSize: fontSizes.sm },
  sendBtn: {
    backgroundColor: colors.backgroundDark,
    paddingVertical: 14,
    alignItems: 'center',
  },
  sendBtnDisabled: { opacity: 0.6 },
  sendBtnText: {
    fontSize: 12,
    fontFamily: fontFamilies.interBold,
    letterSpacing: 1.2,
    color: '#fff',
    textTransform: 'uppercase',
  },
})
