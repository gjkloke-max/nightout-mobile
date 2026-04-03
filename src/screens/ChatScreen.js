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
import NotificationsBellButton from '../components/NotificationsBellButton'
import { ChevronRight, Send, Sparkles } from 'lucide-react-native'
import { colors, fontSizes, fontWeights, spacing, iconSizes, fontFamilies } from '../theme'

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

  const showLanding = !messages.some((m) => m.role === 'user')

  const handleSend = async (overrideText) => {
    const raw = overrideText != null ? String(overrideText) : input
    const text = raw.trim()
    if (!text || loading) return

    setInput('')
    setError(null)

    const userMessage = { role: 'user', content: text }
    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)
    setLoading(true)

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
  }

  const handlePromptPress = (prompt) => {
    handleSend(prompt)
  }

  const handleVenuePress = (venue) => {
    const root = navigation.getParent()?.getParent?.()
    root?.navigate?.('VenueProfile', { venueId: venue?.venue_id })
  }

  const handleNewChat = () => {
    setMessages([])
    setInput('')
    setError(null)
  }

  return (
    <View style={styles.container}>
      <View style={[styles.headerRow, { paddingTop: Math.max(spacing.lg, insets.top) + spacing.md }]}>
        <View style={styles.headerBrand}>
          <View style={styles.logoBox}>
            <Sparkles size={18} color={colors.textOnDark} strokeWidth={2} />
          </View>
          <View>
            <Text style={styles.headerTitle}>Concierge</Text>
            <Text style={styles.headerKicker}>CURATED AI</Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <Pressable onPress={handleNewChat} style={styles.newChatBtn} hitSlop={12}>
            <Text style={styles.newChatText}>New Chat</Text>
          </Pressable>
          <NotificationsBellButton />
        </View>
      </View>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 120 }]}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {showLanding ? (
          <View style={styles.landing}>
            <Text style={styles.heroLine}>What&apos;s your</Text>
            <Text style={styles.heroAccent}>vibe?</Text>
            <Text style={styles.heroSub}>
              Tell me what you&apos;re feeling and I&apos;ll find spots that match.
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
                      {msg.venues.map((v) => (
                        <VenueCard key={v.venue_id} venue={v} onPress={() => handleVenuePress(v)} />
                      ))}
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
            bottom: keyboardHeight,
            paddingBottom: Math.max(spacing.base, keyboardHeight > 0 ? spacing.base : insets.bottom),
          },
        ]}
      >
        <View style={styles.inputField}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Type your request…"
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
            <Send size={iconSizes.button} color={colors.textOnDark} strokeWidth={2} />
          </Pressable>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundCanvas },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.md,
    backgroundColor: colors.backgroundCanvas,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  headerBrand: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1, minWidth: 0 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  logoBox: {
    width: 40,
    height: 40,
    borderRadius: 4,
    backgroundColor: colors.backgroundDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: fontFamilies.frauncesSemiBold,
    fontSize: fontSizes['2xl'],
    color: colors.textPrimary,
  },
  headerKicker: {
    fontFamily: fontFamilies.interBold,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.textSecondary,
    marginTop: 2,
  },
  newChatBtn: { padding: spacing.sm },
  newChatText: { fontSize: fontSizes.sm, color: colors.browseAccent, fontWeight: fontWeights.semibold },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.base, paddingBottom: spacing['2xl'] },
  landing: { paddingTop: spacing.sm },
  heroLine: {
    fontFamily: fontFamilies.frauncesSemiBold,
    fontSize: fontSizes['4xl'],
    lineHeight: 40,
    color: colors.textPrimary,
  },
  heroAccent: {
    fontFamily: fontFamilies.frauncesSemiBold,
    fontSize: fontSizes['4xl'],
    lineHeight: 40,
    color: colors.textPrimary,
    marginTop: 2,
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
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    backgroundColor: colors.backgroundCanvas,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  inputField: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    minHeight: 54,
    paddingLeft: spacing.base,
    paddingRight: 6,
    paddingVertical: 6,
    backgroundColor: colors.backgroundElevated,
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
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: colors.backgroundDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.45 },
})
