import { useState, useRef, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  Keyboard,
  Platform,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { sendConciergeMessage } from '../lib/conciergeApi'
import VenueCard from '../components/VenueCard'
import { Send } from 'lucide-react-native'
import { colors, fontSizes, fontWeights, spacing, iconSizes } from '../theme'

const SUGGESTED_PROMPTS = [
  "What's your vibe?",
  'Date night nearby',
  'Best cocktails tonight',
  'Gluten-free options',
  'Where should I go in Lakeview?',
]

const INITIAL_MESSAGE = {
  role: 'assistant',
  content: "Hello! I'm your concierge assistant. I can help you find the perfect venues based on reviews from our community. What are you looking for today?",
}

const isMoreFollowUp = (msg) =>
  /^(more|additional|other|another|different|more options|give me more|show me more|any others?|what else)\s*$/i.test((msg || '').trim())

export default function ChatScreen() {
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const [messages, setMessages] = useState([INITIAL_MESSAGE])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const scrollRef = useRef(null)

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => setKeyboardHeight(e.endCoordinates.height)
    )
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0)
    )
    return () => {
      showSub.remove()
      hideSub.remove()
    }
  }, [])

  useEffect(() => {
    if (messages.length > 0) {
      scrollRef.current?.scrollToEnd({ animated: true })
    }
  }, [messages])

  const handleSend = async () => {
    const text = (input || '').trim()
    if (!text || loading) return

    setInput('')
    setError(null)

    const userMessage = { role: 'user', content: text }
    setMessages((prev) => [...prev, userMessage])
    setLoading(true)

    const conversationHistory = messages.map((m) => ({
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
  }

  const handlePromptPress = (prompt) => {
    setInput(prompt)
  }

  const handleVenuePress = (venue) => {
    const root = navigation.getParent()?.getParent?.()
    root?.navigate?.('VenueProfile', { venueId: venue?.venue_id })
  }

  const handleNewChat = () => {
    setMessages([INITIAL_MESSAGE])
    setInput('')
    setError(null)
  }

  const hasMessages = messages.length > 1 || (messages[0]?.role === 'user')

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Concierge</Text>
        <Pressable onPress={handleNewChat} style={styles.newChatBtn} hitSlop={12}>
          <Text style={styles.newChatText}>New Chat</Text>
        </Pressable>
      </View>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 }]}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.map((msg, i) => (
          <View key={i} style={[styles.messageRow, msg.role === 'user' ? styles.messageUser : styles.messageAssistant]}>
            <View style={[styles.bubble, msg.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant]}>
              <Text style={[styles.bubbleText, msg.role === 'user' ? styles.bubbleTextUser : styles.bubbleTextAssistant]}>
                {msg.content}
              </Text>
              {msg.role === 'assistant' && msg.venues?.length > 0 ? (
                <View style={styles.venueCards}>
                  {msg.venues.map((v) => (
                    <VenueCard
                      key={v.venue_id}
                      venue={v}
                      onPress={() => handleVenuePress(v)}
                    />
                  ))}
                </View>
              ) : null}
            </View>
          </View>
        ))}
        {loading ? (
          <View style={[styles.messageRow, styles.messageAssistant]}>
            <View style={styles.bubble}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={styles.loadingText}>Finding recommendations...</Text>
            </View>
          </View>
        ) : null}
        {error ? (
          <View style={styles.errorRow}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
        {!hasMessages ? (
          <View style={styles.prompts}>
            <Text style={styles.promptsLabel}>Try asking:</Text>
            {SUGGESTED_PROMPTS.map((prompt, i) => (
              <Pressable
                key={i}
                style={styles.promptChip}
                onPress={() => handlePromptPress(prompt)}
              >
                <Text style={styles.promptText}>{prompt}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </ScrollView>
      <View style={[
        styles.inputRow,
        { bottom: keyboardHeight, paddingBottom: Math.max(spacing.base, keyboardHeight > 0 ? spacing.base : insets.bottom) },
      ]}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Ask for recommendations..."
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={500}
          editable={!loading}
          onSubmitEditing={handleSend}
          returnKeyType="send"
        />
        <Pressable
          style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!input.trim() || loading}
        >
          <Send size={iconSizes.button} color={colors.textOnDark} strokeWidth={2} />
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    paddingTop: spacing.md,
    backgroundColor: colors.backgroundElevated,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  headerTitle: { fontSize: fontSizes.lg, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  newChatBtn: { padding: spacing.sm },
  newChatText: { fontSize: fontSizes.sm, color: colors.accent, fontWeight: fontWeights.semibold },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.base, paddingBottom: spacing['2xl'] },
  messageRow: { marginBottom: spacing.md },
  messageUser: { alignItems: 'flex-end' },
  messageAssistant: { alignItems: 'flex-start' },
  bubble: {
    maxWidth: '85%',
    padding: spacing.base,
    borderRadius: 14,
  },
  bubbleUser: {
    backgroundColor: colors.accent,
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
  prompts: { marginTop: spacing.xl, gap: spacing.sm },
  promptsLabel: { fontSize: fontSizes.sm, color: colors.textMuted, marginBottom: spacing.xs },
  promptChip: {
    padding: spacing.base,
    backgroundColor: colors.surfaceLight,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  promptText: { fontSize: fontSizes.sm, color: colors.textPrimary },
  inputRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: spacing.base,
    paddingTop: spacing.md,
    backgroundColor: colors.backgroundElevated,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: 22,
    fontSize: fontSizes.base,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sendBtn: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    minHeight: 44,
  },
  sendBtnDisabled: { opacity: 0.5 },
})
