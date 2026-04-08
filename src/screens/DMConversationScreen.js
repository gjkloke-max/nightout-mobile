import { useCallback, useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Image,
  Keyboard,
} from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ChevronLeft, Send, MoreVertical } from 'lucide-react-native'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import {
  fetchMessages,
  sendMessage,
  markConversationRead,
  subscribeToConversationMessages,
  displayNameFromProfile,
  formatDmHandle,
} from '../services/messaging'
import { formatMessageTimestamp } from '../utils/dmRelativeTime'
import { parseVenueShareDm } from '../utils/dmVenueShareMessage'
import DmVenueShareCard from '../components/dm/DmVenueShareCard'
import { colors, fontFamilies, fontSizes, fontWeights, spacing } from '../theme'

const SENT_BG = '#9d174d'
const SENT_TIME = '#ffccd3'

export default function DMConversationScreen() {
  const navigation = useNavigation()
  const route = useRoute()
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const conversationId = route.params?.conversationId
  const [peer, setPeer] = useState({ name: 'Messages', handle: '', avatarUrl: null })
  const [peerUserId, setPeerUserId] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [keyboardVisible, setKeyboardVisible] = useState(false)
  const scrollRef = useRef(null)

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'
    const showSub = Keyboard.addListener(showEvt, () => setKeyboardVisible(true))
    const hideSub = Keyboard.addListener(hideEvt, () => setKeyboardVisible(false))
    return () => {
      showSub.remove()
      hideSub.remove()
    }
  }, [])

  const scrollToBottom = () => {
    scrollRef.current?.scrollToEnd?.({ animated: true })
  }

  const loadPeerProfile = useCallback(async () => {
    if (!user?.id || !conversationId) return
    const { data: parts } = await supabase
      .from('dm_conversation_participants')
      .select('user_id')
      .eq('conversation_id', conversationId)
    const otherId = (parts || []).map((p) => p.user_id).find((id) => id !== user.id)
    if (!otherId) {
      setPeerUserId(null)
      return
    }
    setPeerUserId(otherId)
    const { data: prof } = await supabase
      .from('profiles')
      .select('first_name, last_name, avatar_url')
      .eq('id', otherId)
      .maybeSingle()
    setPeer({
      name: displayNameFromProfile(prof),
      handle: formatDmHandle(prof),
      avatarUrl: prof?.avatar_url || null,
    })
  }, [conversationId, user?.id])

  const loadMessages = useCallback(async () => {
    if (!conversationId) return
    const rows = await fetchMessages(conversationId, 200)
    setMessages(rows)
    setTimeout(scrollToBottom, 80)
  }, [conversationId])

  useEffect(() => {
    if (!user?.id || !conversationId) return
    loadPeerProfile()
    loadMessages()
    markConversationRead(conversationId, user.id)

    const unsub = subscribeToConversationMessages(conversationId, (row) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === row.id)) return prev
        return [...prev, row]
      })
      if (row.sender_user_id !== user.id) {
        markConversationRead(conversationId, user.id)
      }
      setTimeout(scrollToBottom, 80)
    })
    return () => unsub()
  }, [conversationId, user?.id, loadMessages, loadPeerProfile])

  const openPeerProfile = useCallback(() => {
    if (!peerUserId) return
    navigation.navigate('FriendProfile', { userId: peerUserId })
  }, [navigation, peerUserId])

  const openVenueFromDm = useCallback(
    (venueId) => {
      const id = venueId != null ? String(venueId) : ''
      if (!id) return
      navigation.navigate('VenueProfile', { venueId: id })
    },
    [navigation]
  )

  const onSend = async () => {
    const text = input.trim()
    if (!text || !conversationId || sending) return
    setSending(true)
    const tempId = `temp-${Date.now()}`
    const optimistic = {
      id: tempId,
      sender_user_id: user.id,
      body: text,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimistic])
    setInput('')
    setTimeout(scrollToBottom, 40)

    try {
      const saved = await sendMessage(conversationId, text)
      setMessages((prev) => prev.map((m) => (m.id === tempId ? saved : m)))
    } catch (e) {
      console.warn(e)
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
    } finally {
      setSending(false)
    }
  }

  const peerInitials = peer.name
    .split(/\s+/)
    .map((s) => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  if (!user) return null

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <View style={[styles.container, { paddingTop: Math.max(spacing.lg, insets.top) }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn} hitSlop={12} accessibilityLabel="Back">
            <ChevronLeft size={24} color={colors.textPrimary} strokeWidth={2} />
          </TouchableOpacity>
          <View style={styles.headerPeer}>
            <Pressable
              onPress={openPeerProfile}
              disabled={!peerUserId}
              style={({ pressed }) => [styles.headerAvatar, pressed && styles.headerPeerPressed]}
              accessibilityRole="button"
              accessibilityLabel={`Open profile for ${peer.name}`}
            >
              {peer.avatarUrl ? (
                <Image source={{ uri: peer.avatarUrl }} style={styles.headerAvatarImg} />
              ) : (
                <Text style={styles.headerAvatarText}>{peerInitials}</Text>
              )}
            </Pressable>
            <View style={styles.headerText}>
              <Pressable
                onPress={openPeerProfile}
                disabled={!peerUserId}
                style={({ pressed }) => pressed && styles.headerPeerPressed}
                accessibilityRole="button"
                accessibilityLabel={`Open profile for ${peer.name}`}
              >
                <Text style={styles.headerName} numberOfLines={1}>
                  {peer.name}
                </Text>
              </Pressable>
              {peer.handle ? (
                <Pressable
                  onPress={openPeerProfile}
                  disabled={!peerUserId}
                  style={({ pressed }) => [styles.headerHandlePress, pressed && styles.headerPeerPressed]}
                  accessibilityRole="button"
                  accessibilityLabel={`Open profile for ${peer.handle}`}
                >
                  <Text style={styles.headerHandle} numberOfLines={1}>
                    {peer.handle}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>
          <TouchableOpacity style={styles.headerBtn} hitSlop={12} accessibilityLabel="Conversation options">
            <MoreVertical size={20} color={colors.textPrimary} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          onContentSizeChange={scrollToBottom}
        >
          {messages.length === 0 ? (
            <Text style={styles.hint}>No messages yet. Say hello below.</Text>
          ) : (
            messages.map((m) => {
              const sent = m.sender_user_id === user.id
              const share = parseVenueShareDm(m.body || '')
              if (share) {
                return (
                  <View key={m.id} style={[styles.bubbleRow, sent ? styles.bubbleRowSent : styles.bubbleRowRecv]}>
                    <View
                      style={[
                        styles.venueShareStack,
                        sent ? styles.venueShareStackSent : styles.venueShareStackRecv,
                      ]}
                    >
                      <DmVenueShareCard
                        variant="thread"
                        snapshot={share.snapshot}
                        onPress={() => openVenueFromDm(share.snapshot.venueId)}
                      />
                      {share.caption ? (
                        <Text
                          style={[styles.venueShareCaption, sent && styles.venueShareCaptionSent]}
                        >
                          {share.caption}
                        </Text>
                      ) : null}
                      <Text style={[styles.bubbleTime, sent ? styles.venueShareTimeSent : styles.bubbleTimeRecv]}>
                        {formatMessageTimestamp(m.created_at)}
                      </Text>
                    </View>
                  </View>
                )
              }
              return (
                <View key={m.id} style={[styles.bubbleRow, sent ? styles.bubbleRowSent : styles.bubbleRowRecv]}>
                  <View style={[styles.bubble, sent ? styles.bubbleSent : styles.bubbleRecv]}>
                    <Text style={[styles.bubbleBody, sent ? styles.bubbleBodySent : styles.bubbleBodyRecv]}>{m.body}</Text>
                    <Text style={[styles.bubbleTime, sent ? styles.bubbleTimeSent : styles.bubbleTimeRecv]}>
                      {formatMessageTimestamp(m.created_at)}
                    </Text>
                  </View>
                </View>
              )
            })
          )}
        </ScrollView>

        <View
          style={[
            styles.inputWrap,
            {
              paddingBottom: keyboardVisible ? spacing.sm : Math.max(spacing.md, insets.bottom),
            },
          ]}
        >
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder="Message…"
              placeholderTextColor={colors.textTag}
              maxLength={8000}
              onSubmitEditing={onSend}
              returnKeyType="send"
              blurOnSubmit={false}
            />
            <TouchableOpacity
              style={[styles.sendIconBtn, (!input.trim() || sending) && styles.sendIconBtnDisabled]}
              onPress={onSend}
              disabled={sending || !input.trim()}
              accessibilityLabel="Send message"
            >
              <Send
                size={20}
                color={!input.trim() || sending ? colors.textMuted : colors.textOnDark}
                strokeWidth={2}
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: colors.backgroundCanvas },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: 12,
    backgroundColor: colors.backgroundElevated,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  headerBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerPeer: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minWidth: 0 },
  headerPeerPressed: { opacity: 0.75 },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    backgroundColor: colors.backgroundMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerHandlePress: { alignSelf: 'flex-start' },
  headerAvatarImg: { width: '100%', height: '100%' },
  headerAvatarText: { fontSize: fontSizes.sm, fontWeight: fontWeights.semibold, color: colors.textSecondary },
  headerText: { flex: 1, minWidth: 0 },
  headerName: {
    fontFamily: fontFamilies.frauncesRegular,
    fontSize: fontSizes.lg,
    lineHeight: 28,
    color: colors.textPrimary,
  },
  headerHandle: {
    fontFamily: fontFamilies.inter,
    fontSize: fontSizes.xs,
    lineHeight: 16,
    color: colors.textTag,
    marginTop: 2,
  },
  scroll: { flex: 1 },
  scrollContent: {
    padding: spacing.xl,
    paddingBottom: spacing['2xl'],
    flexGrow: 1,
  },
  hint: { textAlign: 'center', color: colors.textSecondary, fontSize: fontSizes.sm },
  /* Full width so %-sized venue cards resolve against the thread, not shrink-wrapped text */
  bubbleRow: { flexDirection: 'row', marginBottom: 16, width: '100%' },
  bubbleRowSent: { justifyContent: 'flex-end' },
  bubbleRowRecv: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '86%',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    gap: 8,
  },
  bubbleSent: { backgroundColor: SENT_BG },
  bubbleRecv: { backgroundColor: colors.backgroundMuted },
  bubbleBody: { fontFamily: fontFamilies.inter, fontSize: fontSizes.sm, lineHeight: 23 },
  bubbleBodySent: { color: colors.textOnDark },
  bubbleBodyRecv: { color: colors.textPrimary },
  bubbleTime: { fontFamily: fontFamilies.inter, fontSize: 10, lineHeight: 15 },
  bubbleTimeSent: { color: SENT_TIME },
  bubbleTimeRecv: { color: colors.textSecondary },
  venueShareStack: {
    padding: 12,
    borderRadius: 16,
    gap: 8,
  },
  venueShareStackRecv: {
    backgroundColor: colors.backgroundMuted,
    width: '100%',
  },
  venueShareStackSent: {
    backgroundColor: SENT_BG,
    width: '92%',
  },
  venueShareCaption: {
    fontFamily: fontFamilies.inter,
    fontSize: fontSizes.sm,
    lineHeight: 23,
    color: colors.textPrimary,
  },
  venueShareCaptionSent: {
    color: colors.textOnDark,
  },
  venueShareTimeSent: {
    color: SENT_TIME,
  },
  inputWrap: {
    backgroundColor: colors.backgroundElevated,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingTop: 10,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    backgroundColor: colors.backgroundMuted,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 4,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    paddingVertical: 10,
    paddingHorizontal: 4,
    fontFamily: fontFamilies.inter,
    fontSize: fontSizes.base,
    lineHeight: 22,
    color: colors.textPrimary,
    backgroundColor: 'transparent',
  },
  sendIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.textPrimary,
    marginBottom: 2,
  },
  sendIconBtnDisabled: { opacity: 0.4, backgroundColor: colors.border },
})
