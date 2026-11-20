/**
 * Thumbs up / down under one concierge answer. Shown only for answers that came with a trace id
 * (this session's answers, when the server is saving traces).
 *
 * A thumbs up is sent at once. A thumbs down is sent at once too, so the rating is never lost, and
 * then offers three one-tap reasons and an optional note that update it.
 */
import React, { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { ThumbsDown, ThumbsUp } from 'lucide-react-native'
import {
  buildConciergeFeedbackBody,
  CONCIERGE_FEEDBACK_NOTE_MAX,
  CONCIERGE_FEEDBACK_REASONS,
} from '../vendor/pulse-web/shared/concierge-client/feedback.js'
import { sendConciergeFeedback } from '../lib/conciergeApi'
import { colors, fontFamilies, fontSizes, spacing } from '../theme'

export default function ConciergeFeedback({ traceId }) {
  const [rating, setRating] = useState(null)
  const [reason, setReason] = useState(null)
  const [note, setNote] = useState('')
  const [noteSent, setNoteSent] = useState(false)
  const [failed, setFailed] = useState(false)

  if (!traceId) return null

  const submit = async (next) => {
    const body = buildConciergeFeedbackBody({ traceId, ...next })
    if (!body) return
    setFailed(false)
    const { error } = await sendConciergeFeedback(body)
    if (error) setFailed(true)
  }

  const rate = (value) => {
    setRating(value)
    setNoteSent(false)
    if (value === 'up') setReason(null)
    submit({ rating: value, reason: value === 'down' ? reason : null, note: value === 'down' ? note : '' })
  }
  const pickReason = (id) => {
    const next = reason === id ? null : id
    setReason(next)
    submit({ rating: 'down', reason: next, note })
  }
  const sendNote = async () => {
    if (!note.trim() || noteSent) return
    await submit({ rating: 'down', reason, note })
    setNoteSent(true)
  }

  const thumbColor = (value) => (rating === value ? colors.browseAccent : colors.textSecondary)

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={styles.prompt}>{rating && !failed ? 'Thanks for the feedback.' : 'Was this helpful?'}</Text>
        <Pressable
          style={[styles.thumb, rating === 'up' && styles.thumbSelected]}
          onPress={() => rate('up')}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Helpful"
          accessibilityState={{ selected: rating === 'up' }}
        >
          <ThumbsUp size={16} color={thumbColor('up')} strokeWidth={2} />
        </Pressable>
        <Pressable
          style={[styles.thumb, rating === 'down' && styles.thumbSelected]}
          onPress={() => rate('down')}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Not helpful"
          accessibilityState={{ selected: rating === 'down' }}
        >
          <ThumbsDown size={16} color={thumbColor('down')} strokeWidth={2} />
        </Pressable>
      </View>
      {rating === 'down' ? (
        <View style={styles.detail}>
          <View style={styles.reasons}>
            {CONCIERGE_FEEDBACK_REASONS.map((r) => {
              const selected = reason === r.id
              return (
                <Pressable
                  key={r.id}
                  style={[styles.reason, selected && styles.reasonSelected]}
                  onPress={() => pickReason(r.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <Text style={[styles.reasonText, selected && styles.reasonTextSelected]}>{r.label}</Text>
                </Pressable>
              )
            })}
          </View>
          <View style={styles.noteRow}>
            <TextInput
              style={styles.noteInput}
              value={note}
              onChangeText={(text) => {
                setNote(text)
                setNoteSent(false)
              }}
              placeholder="Anything else? (optional)"
              placeholderTextColor={colors.textMuted}
              maxLength={CONCIERGE_FEEDBACK_NOTE_MAX}
              returnKeyType="send"
              onSubmitEditing={sendNote}
              accessibilityLabel="Tell us more (optional)"
            />
            <Pressable
              style={[styles.noteButton, (!note.trim() || noteSent) && styles.noteButtonDisabled]}
              onPress={sendNote}
              disabled={!note.trim() || noteSent}
              accessibilityRole="button"
            >
              <Text style={styles.noteButtonText}>{noteSent ? 'Sent' : 'Send'}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      {failed ? <Text style={styles.error}>Couldn’t save that. Please try again.</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.xs, paddingLeft: spacing.xs, maxWidth: '85%' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  prompt: { fontSize: fontSizes.xs, color: colors.textSecondary, marginRight: spacing.xs },
  thumb: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  thumbSelected: { borderColor: colors.browseAccent },
  detail: { marginTop: spacing.xs, gap: spacing.sm },
  reasons: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  reason: {
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.surfaceLight,
  },
  reasonSelected: { borderColor: colors.browseAccent, backgroundColor: colors.browseAccent },
  reasonText: { fontSize: fontSizes.xs, fontFamily: fontFamilies.interMedium, color: colors.textPrimary },
  reasonTextSelected: { color: colors.textOnDark },
  noteRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  noteInput: {
    flex: 1,
    minHeight: 36,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderLight,
    fontSize: fontSizes.sm,
    color: colors.textPrimary,
  },
  noteButton: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderLight,
    justifyContent: 'center',
  },
  noteButtonDisabled: { opacity: 0.5 },
  noteButtonText: { fontSize: fontSizes.sm, fontFamily: fontFamilies.interMedium, color: colors.textPrimary },
  error: { marginTop: spacing.xs, fontSize: fontSizes.xs, color: colors.error },
})
