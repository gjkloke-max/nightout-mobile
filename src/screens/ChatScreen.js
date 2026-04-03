import { useState, useRef, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  Platform,
  Modal,
  FlatList,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { sendConciergeMessage } from '../lib/conciergeApi'
import VenueCard from '../components/VenueCard'
import { ChevronRight, Send, Menu, SquarePen } from 'lucide-react-native'
import {
  getActiveSession,
  createNewSession,
  saveMessage,
  loadSession,
  loadChatHistoryWithPreviews,
  updateSessionTitle,
  generateSessionTitle,
  formatChatRelativeDate,
  deleteSession,
} from '../utils/chatHistory'
import { colors, fontSizes, spacing, fontFamilies } from '../theme'

const SUGGESTED_PROMPTS = [
  'Date night nearby',
  'Best cocktails',
  'Gluten-free options',
  'Where should I go in Lakeview?',
]

const isMoreFollowUp = (msg) =>
  /^(more|additional|other|another|different|more options|give me more|show me more|any others?|what else)\s*$/i.test((msg || '').trim())

export default function ChatScreen() {
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const scrollRef = useRef(null)
  const [currentSessionId, setCurrentSessionId] = useState(null)
  const [chatSessions, setChatSessions] = useState([])
  const [chatPreviews, setChatPreviews] = useState({})
  const [historyOpen, setHistoryOpen] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [keyboardVisible, setKeyboardVisible] = useState(false)

  const refreshHistoryList = useCallback(async () => {
    const { data: sessions, previews, error } = await loadChatHistoryWithPreviews()
    if (!error && sessions) {
      setChatSessions(sessions)
      setChatPreviews(previews || {})
    }
  }, [])

  useEffect(() => {
    if (!user?.id) {
      setInitializing(false)
      return
    }

    const init = async () => {
      try {
        const { data: activeSession } = await getActiveSession()
        if (activeSession?.chat_session_id) {
          const { data: sessionData, error } = await loadSession(activeSession.chat_session_id)
          if (!error && sessionData?.messages) {
            setMessages(sessionData.messages)
            setCurrentSessionId(activeSession.chat_session_id)
          } else {
            const { data: newSession } = await createNewSession()
            if (newSession) setCurrentSessionId(newSession.chat_session_id)
          }
        } else {
          const { data: newSession } = await createNewSession()
          if (newSession) setCurrentSessionId(newSession.chat_session_id)
        }
        await refreshHistoryList()
      } catch (e) {
        console.error('Chat init', e)
      } finally {
        setInitializing(false)
      }
    }

    init()
  }, [user?.id, refreshHistoryList])

  useEffect(() => {
    if (historyOpen && user?.id) refreshHistoryList()
  }, [historyOpen, user?.id, refreshHistoryList])

  useEffect(() => {
    if (messages.length > 0) {
      scrollRef.current?.scrollToEnd({ animated: true })
    }
  }, [messages])

  const showLanding = !messages.some((m) => m.role === 'user')

  const handleSend = async (overrideText) => {
    const raw = overrideText != null ? String(overrideText) : input
    const text = raw.trim()
    if (!text || loading) return

    if (!user?.id) {
      setError('Sign in to save chats and use Concierge.')
      return
    }

    setInput('')
    setError(null)

    let sessionId = currentSessionId
    if (!sessionId) {
      const { data: newSession } = await createNewSession()
      if (newSession) {
        sessionId = newSession.chat_session_id
        setCurrentSessionId(sessionId)
      }
    }

    const userMessage = { role: 'user', content: text }
    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)
    setLoading(true)

    if (sessionId) {
      await saveMessage(sessionId, 'user', text, [])
      const priorUserCount = messages.filter((m) => m.role === 'user').length
      if (priorUserCount === 0) {
        const title = generateSessionTitle(text)
        await updateSessionTitle(sessionId, title)
        await refreshHistoryList()
      }
    }

    const conversationHistory = nextMessages.map((m) => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content : '',
    }))

    let userHome = null
    if (user?.id && supabase) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('home_neighborhood_name, home_lat, home_lng')
        .eq('id', user.id)
        .single()
      if (profile && (profile.home_lat != null || profile.home_lng != null)) {
        userHome = {
          homeNeighborhoodName: profile.home_neighborhood_name ?? null,
          lat: profile.home_lat != null ? parseFloat(profile.home_lat) : null,
          lng: profile.home_lng != null ? parseFloat(profile.home_lng) : null,
        }
      }
    }

    const introducedVenueIds = []
    messages.forEach((m) => {
      if (m.role === 'assistant' && Array.isArray(m.venues)) {
        m.venues.forEach((v) => {
          const vid = v?.venue_id ?? v?.venueId
          if (vid != null && !introducedVenueIds.includes(vid)) introducedVenueIds.push(vid)
        })
      }
    })
    const excludeVenueIds = isMoreFollowUp(text) && introducedVenueIds.length > 0 ? introducedVenueIds : []

    const { data, error: err } = await sendConciergeMessage({
      message: text,
      conversationHistory,
      userPreferences: null,
      userHome,
      excludeVenueIds,
    })

    setLoading(false)

    if (err) {
      setError(err.message || 'Something went wrong')
      setMessages((prev) => prev.slice(0, -1))
      return
    }

    const assistantMessage = {
      role: 'assistant',
      content: data.response || '',
      venues: data.venues || [],
    }
    setMessages((prev) => [...prev, assistantMessage])

    if (sessionId) {
      await saveMessage(sessionId, 'assistant', assistantMessage.content, assistantMessage.venues || [])
      await refreshHistoryList()
    }
  }

  const handlePromptPress = (prompt) => {
    handleSend(prompt)
  }

  const handleVenuePress = (venue) => {
    const root = navigation.getParent()?.getParent?.()
    root?.navigate?.('VenueProfile', { venueId: venue?.venue_id })
  }

  const handleNewChat = async () => {
    try {
      const { data: newSession } = await createNewSession()
      if (newSession) {
        setCurrentSessionId(newSession.chat_session_id)
        setMessages([])
        setInput('')
        setError(null)
        await refreshHistoryList()
      }
    } catch (e) {
      setError('Could not start a new chat')
    }
  }

  const handleLoadSession = async (sessionId) => {
    try {
      setLoading(true)
      const { data: sessionData, error } = await loadSession(sessionId)
      if (!error && sessionData?.messages) {
        setMessages(sessionData.messages)
        setCurrentSessionId(sessionId)
        setHistoryOpen(false)
      } else {
        setError('Failed to load chat')
      }
    } catch (e) {
      setError('Failed to load chat')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteSession = (sessionId) => {
    Alert.alert('Delete chat?', 'This conversation will be removed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error: delErr } = await deleteSession(sessionId)
          if (delErr) {
            setError(delErr.message || 'Could not delete')
            return
          }
          if (sessionId === currentSessionId) {
            await handleNewChat()
          } else {
            await refreshHistoryList()
          }
        },
      },
    ])
  }

  if (!user) return null

  if (initializing) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.browseAccent} />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={[styles.headerRow, { paddingTop: Math.max(spacing.lg, insets.top) + spacing.md }]}>
        <View style={styles.headerLeft}>
          <Pressable
            style={styles.menuBtn}
            onPress={() => setHistoryOpen(true)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Chat history"
          >
            <Menu size={22} color={colors.textPrimary} strokeWidth={2} />
          </Pressable>
          <View style={styles.headerTitles}>
            <Text style={styles.headerTitle}>Concierge</Text>
            <Text style={styles.headerKicker}>CURATED AI</Text>
          </View>
        </View>
        <Pressable
          onPress={handleNewChat}
          style={styles.composeBtn}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="New chat"
        >
          <SquarePen size={20} color={colors.textPrimary} strokeWidth={2} />
        </Pressable>
      </View>

      <Modal
        visible={historyOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setHistoryOpen(false)}
      >
        <View style={styles.historyModalRoot}>
          <View style={[styles.historyDrawer, { paddingTop: insets.top }]}>
            <View style={styles.historyDrawerHeader}>
              <Text style={styles.historyDrawerTitle}>CHAT HISTORY</Text>
            </View>
            {chatSessions.length === 0 ? (
              <Text style={styles.historyEmpty}>No previous chats</Text>
            ) : (
              <FlatList
                data={chatSessions}
                keyExtractor={(item) => String(item.chat_session_id)}
                style={styles.historyList}
                contentContainerStyle={styles.historyListContent}
                renderItem={({ item }) => (
                  <View style={styles.historyRowWrap}>
                    <Pressable
                      style={[
                        styles.historyRow,
                        item.chat_session_id === currentSessionId && styles.historyRowActive,
                      ]}
                      onPress={() => handleLoadSession(item.chat_session_id)}
                    >
                      <View style={styles.historyRowTop}>
                        <Text style={styles.historyRowTitle} numberOfLines={1}>
                          {item.title || 'New Chat'}
                        </Text>
                        <Text style={styles.historyRowDate}>
                          {formatChatRelativeDate(item.updated_at, { uppercase: true })}
                        </Text>
                      </View>
                      {chatPreviews[item.chat_session_id] ? (
                        <Text style={styles.historyRowPreview} numberOfLines={2}>
                          {chatPreviews[item.chat_session_id]}
                        </Text>
                      ) : null}
                    </Pressable>
                    <Pressable
                      style={styles.historyDelete}
                      onPress={() => handleDeleteSession(item.chat_session_id)}
                      hitSlop={8}
                    >
                      <Text style={styles.historyDeleteText}>×</Text>
                    </Pressable>
                  </View>
                )}
              />
            )}
          </View>
          <Pressable style={styles.historyBackdrop} onPress={() => setHistoryOpen(false)} />
        </View>
      </Modal>

      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        enabled={Platform.OS === 'ios'}
        keyboardVerticalOffset={0}
      >
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingBottom: spacing.lg,
            paddingTop: showLanding ? spacing['2xl'] : spacing.md,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {showLanding ? (
          <View style={styles.landing}>
            <Text style={styles.heroLine}>What&apos;s your</Text>
            <Text style={styles.heroAccent}>vibe?</Text>
            <Text style={styles.heroSub}>
              Tell me what you&apos;re feeling and I&apos;ll recommend the perfect spot.
            </Text>
            <View style={styles.promptList}>
              {SUGGESTED_PROMPTS.map((prompt) => (
                <Pressable
                  key={prompt}
                  style={({ pressed }) => [styles.promptRow, pressed && styles.promptRowPressed]}
                  onPress={() => handlePromptPress(prompt)}
                  disabled={loading}
                >
                  <Text style={styles.promptLabel}>{prompt.toUpperCase()}</Text>
                  <ChevronRight size={16} color={colors.textPrimary} style={{ opacity: 0.55 }} />
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          <>
            {messages.map((msg, i) => (
              <View
                key={i}
                style={[styles.messageRow, msg.role === 'user' ? styles.messageUser : styles.messageAssistant]}
              >
                <View style={[styles.bubble, msg.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant]}>
                  <Text
                    style={[styles.bubbleText, msg.role === 'user' ? styles.bubbleTextUser : styles.bubbleTextAssistant]}
                  >
                    {msg.content}
                  </Text>
                  {msg.role === 'assistant' && msg.venues?.length > 0 ? (
                    <View style={styles.venueCards}>
                      {msg.venues.map((v, vidx) => {
                        const vid = v?.venue_id ?? v?.venueId
                        return (
                          <VenueCard
                            key={`m${i}-v${vidx}-${vid != null ? String(vid) : 'x'}`}
                            venue={v.venue ?? v}
                            onPress={() => handleVenuePress(v)}
                          />
                        )
                      })}
                    </View>
                  ) : null}
                </View>
              </View>
            ))}
            {loading ? (
              <View style={[styles.messageRow, styles.messageAssistant]}>
                <View style={styles.bubble}>
                  <ActivityIndicator size="small" color={colors.browseAccent} />
                  <Text style={styles.loadingText}>Finding recommendations...</Text>
                </View>
              </View>
            ) : null}
            {error ? (
              <View style={styles.errorRow}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
      <View
        style={[
          styles.inputRow,
          {
            paddingBottom: keyboardVisible
              ? spacing.sm
              : Math.max(spacing.base, insets.bottom),
          },
        ]}
      >
        <View style={styles.inputField}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Type your request..."
            placeholderTextColor="#9f9fa9"
            multiline
            maxLength={500}
            editable={!loading}
            onSubmitEditing={() => handleSend()}
            returnKeyType="send"
          />
          <Pressable
            style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
            onPress={() => handleSend()}
            disabled={!input.trim() || loading}
          >
            <Send
              size={18}
              color={!input.trim() || loading ? colors.textMuted : colors.textSecondary}
              strokeWidth={2}
            />
          </Pressable>
        </View>
      </View>
      </KeyboardAvoidingView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundCanvas },
  keyboardAvoid: { flex: 1 },
  centered: { justifyContent: 'center', alignItems: 'center' },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
    backgroundColor: colors.backgroundCanvas,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
    flex: 1,
    minWidth: 0,
  },
  menuBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitles: { flexShrink: 1 },
  headerTitle: {
    fontFamily: fontFamilies.frauncesSemiBold,
    fontSize: 24,
    lineHeight: 28,
    color: colors.textPrimary,
  },
  headerKicker: {
    fontFamily: fontFamilies.interBold,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.textSecondary,
    marginTop: 4,
  },
  composeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyModalRoot: {
    flex: 1,
    flexDirection: 'row',
  },
  historyBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  historyDrawer: {
    width: 320,
    maxWidth: '88%',
    alignSelf: 'stretch',
    backgroundColor: colors.backgroundElevated,
    borderRightWidth: 1,
    borderRightColor: colors.borderLight,
  },
  historyDrawerHeader: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  historyDrawerTitle: {
    fontFamily: fontFamilies.interBold,
    fontSize: fontSizes.lg,
    letterSpacing: 1.8,
    color: colors.textPrimary,
  },
  historyEmpty: {
    padding: spacing.base,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
  },
  historyList: { flex: 1 },
  historyListContent: { paddingBottom: spacing['2xl'] },
  historyRowWrap: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'stretch',
    borderBottomWidth: 1,
    borderBottomColor: '#f4f4f5',
  },
  historyRow: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingLeft: spacing.base,
    paddingRight: 36,
  },
  historyRowActive: {
    backgroundColor: 'rgba(157, 23, 77, 0.06)',
  },
  historyRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  historyRowTitle: {
    flex: 1,
    fontFamily: fontFamilies.interBold,
    fontSize: fontSizes.sm,
    color: colors.textPrimary,
  },
  historyRowDate: {
    fontFamily: fontFamilies.interMedium,
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: '#9f9fa9',
  },
  historyRowPreview: {
    marginTop: spacing.xs,
    fontFamily: fontFamilies.frauncesItalic,
    fontSize: 12,
    lineHeight: 16,
    color: '#71717b',
  },
  historyDelete: {
    position: 'absolute',
    right: 4,
    top: 8,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyDeleteText: {
    fontSize: 20,
    color: colors.error,
    lineHeight: 22,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.xl, paddingBottom: spacing['2xl'] },
  landing: { paddingTop: 0 },
  heroLine: {
    fontFamily: fontFamilies.frauncesSemiBold,
    fontSize: 36,
    lineHeight: 40,
    color: colors.textPrimary,
  },
  heroAccent: {
    fontFamily: fontFamilies.frauncesSemiBold,
    fontSize: 36,
    lineHeight: 40,
    color: colors.textPrimary,
    marginTop: 0,
  },
  heroSub: {
    fontFamily: fontFamilies.frauncesItalic,
    fontSize: fontSizes.base,
    lineHeight: 24,
    color: '#52525c',
    marginTop: spacing.base,
    maxWidth: 320,
  },
  promptList: {
    marginTop: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  promptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 49,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  promptRowPressed: { backgroundColor: 'rgba(24,24,27,0.03)' },
  promptLabel: {
    flex: 1,
    fontFamily: fontFamilies.interBold,
    fontSize: 12,
    letterSpacing: 1.2,
    color: '#27272a',
  },
  messageRow: { marginBottom: spacing.md },
  messageUser: { alignItems: 'flex-end' },
  messageAssistant: { alignItems: 'flex-start' },
  bubble: {
    maxWidth: '85%',
    padding: spacing.base,
    borderRadius: 14,
  },
  bubbleUser: {
    backgroundColor: colors.browseAccent,
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    backgroundColor: colors.surfaceLight,
    borderBottomLeftRadius: 4,
  },
  bubbleText: { fontSize: fontSizes.base, lineHeight: 22 },
  bubbleTextUser: { color: colors.textOnDark },
  bubbleTextAssistant: { color: colors.textPrimary },
  venueCards: { marginTop: spacing.md, gap: spacing.sm },
  loadingText: { fontSize: fontSizes.sm, color: colors.textMuted, marginTop: spacing.xs },
  errorRow: { padding: spacing.md },
  errorText: { fontSize: fontSizes.sm, color: colors.error },
  inputRow: {
    flexShrink: 0,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    backgroundColor: colors.backgroundCanvas,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  inputField: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 54,
    paddingLeft: spacing.base,
    paddingRight: 6,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.borderInput,
    borderRadius: 8,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    paddingVertical: spacing.sm,
    fontSize: fontSizes.sm,
    fontFamily: fontFamilies.frauncesItalic,
    color: colors.textPrimary,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.45 },
})
