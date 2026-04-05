import { useCallback, useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ChevronLeft } from 'lucide-react-native'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import {
  fetchMessages,
  sendMessage,
  markConversationRead,
  subscribeToConversationMessages,
  displayNameFromProfile,
} from '../services/messaging'
import { colors, fontFamilies, fontSizes, fontWeights, spacing, borderRadius } from '../theme'

export default function DMConversationScreen() {
  const navigation = useNavigation()
  const route = useRoute()
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const conversationId = route.params?.conversationId
  const [title, setTitle] = useState('Messages')
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef(null)

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
    if (!otherId) return
    const { data: prof } = await supabase.from('profiles').select('first_name, last_name').eq('id', otherId).maybeSingle()
    setTitle(displayNameFromProfile(prof))
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

  if (!user) return null

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={insets.top}
    >
      <View style={[styles.container, { paddingTop: Math.max(spacing.lg, insets.top) }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn} hitSlop={12} accessibilityLabel="Back">
            <ChevronLeft size={24} color={colors.textPrimary} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {title}
          </Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          onContentSizeChange={scrollToBottom}
        >
          {messages.length === 0 ? (
            <Text style={styles.hint}>No messages yet. Say hello below.</Text>
          ) : (
            messages.map((m) => {
              const sent = m.sender_user_id === user.id
              return (
                <View key={m.id} style={[styles.bubbleRow, sent ? styles.bubbleRowSent : styles.bubbleRowRecv]}>
                  <View style={[styles.bubble, sent ? styles.bubbleSent : styles.bubbleRecv]}>
                    <Text style={[styles.bubbleText, sent ? styles.bubbleTextSent : styles.bubbleTextRecv]}>{m.body}</Text>
                  </View>
                </View>
              )
            })
          )}
        </ScrollView>

        <View style={[styles.inputBar, { paddingBottom: Math.max(spacing.md, insets.bottom) }]}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Message…"
            placeholderTextColor={colors.textTag}
            multiline
            maxLength={8000}
            onSubmitEditing={onSend}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
            onPress={onSend}
            disabled={sending || !input.trim()}
          >
            <Text style={styles.sendBtnText}>Send</Text>
          </TouchableOpacity>
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
    gap: 8,
  },
  headerBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    flex: 1,
    fontFamily: fontFamilies.frauncesRegular,
    fontSize: fontSizes.xl,
    color: colors.textPrimary,
  },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.xl, paddingBottom: 24 },
  hint: { textAlign: 'center', color: colors.textSecondary, fontSize: fontSizes.sm },
  bubbleRow: { marginBottom: 12, flexDirection: 'row' },
  bubbleRowSent: { justifyContent: 'flex-end' },
  bubbleRowRecv: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '85%', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12 },
  bubbleSent: { backgroundColor: colors.backgroundDark },
  bubbleRecv: { backgroundColor: colors.backgroundMuted },
  bubbleText: { fontFamily: fontFamilies.interMedium, fontSize: 15, lineHeight: 22 },
  bubbleTextSent: { color: colors.textOnDark },
  bubbleTextRecv: { color: colors.textPrimary },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    paddingHorizontal: spacing.xl,
    paddingTop: 12,
    backgroundColor: colors.backgroundElevated,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: colors.borderInput,
    borderRadius: borderRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: fontFamilies.interMedium,
    fontSize: 15,
    color: colors.textPrimary,
    backgroundColor: colors.backgroundCanvas,
  },
  sendBtn: {
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: borderRadius.md,
    backgroundColor: colors.backgroundDark,
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.45 },
  sendBtnText: { color: colors.textOnDark, fontFamily: fontFamilies.interSemiBold, fontWeight: fontWeights.semibold, fontSize: 15 },
})
