/**
 * Reason picker for reporting content, shared by every surface that can be reported.
 *
 * Deliberately a modal rather than an Alert: there are seven reasons plus an optional free-text
 * box, and Alert on iOS degrades badly past three buttons. Keeping it in one component also means
 * the reasons and the wording cannot drift between the places a report can be filed from.
 */
import { useState } from 'react'
import { View, Text, StyleSheet, Modal, Pressable, TextInput, ScrollView, ActivityIndicator } from 'react-native'
import { colors, fontFamilies, spacing } from '../theme'
import { REPORT_REASONS, submitReport } from '../services/contentReports'

/**
 * @param {object} props
 * @param {boolean} props.visible
 * @param {() => void} props.onClose
 * @param {string} props.contentType one of REPORT_CONTENT_TYPE
 * @param {string|number} props.contentId
 * @param {string|null} [props.reportedUserId]
 * @param {string} [props.title]
 * @param {(result: { blocked?: boolean }) => void} [props.onReported]
 * @param {() => Promise<void>|void} [props.onAlsoBlock] when given, offers blocking after reporting
 */
export default function ReportContentModal({
  visible,
  onClose,
  contentType,
  contentId,
  reportedUserId,
  title = 'Report content',
  onReported,
  onAlsoBlock,
}) {
  const [reason, setReason] = useState(null)
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [sent, setSent] = useState(false)

  const reset = () => {
    setReason(null)
    setDetails('')
    setBusy(false)
    setError(null)
    setSent(false)
  }

  const close = () => {
    reset()
    onClose?.()
  }

  const send = async () => {
    if (!reason || busy) return
    setBusy(true)
    setError(null)
    const { error: err } = await submitReport({
      contentType,
      contentId,
      reportedUserId,
      reason,
      details,
    })
    setBusy(false)
    if (err) {
      setError(err.message)
      return
    }
    // Reporting and blocking are different decisions, so the block is offered rather than implied.
    if (onAlsoBlock) {
      setSent(true)
      return
    }
    onReported?.({ blocked: false })
    close()
  }

  const blockToo = async () => {
    setBusy(true)
    await onAlsoBlock?.()
    setBusy(false)
    onReported?.({ blocked: true })
    close()
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close} />
      <View style={styles.sheet}>
        {sent ? (
          <View>
            <Text style={styles.title}>Report sent</Text>
            <Text style={styles.body}>
              Thanks — we review every report. You can also stop seeing this person entirely.
            </Text>
            <Pressable style={[styles.primaryBtn, busy && styles.btnDisabled]} onPress={blockToo} disabled={busy}>
              {busy ? <ActivityIndicator color={colors.backgroundElevated} /> : <Text style={styles.primaryBtnText}>Block this person</Text>}
            </Pressable>
            <Pressable style={styles.secondaryBtn} onPress={close} disabled={busy}>
              <Text style={styles.secondaryBtnText}>Not now</Text>
            </Pressable>
          </View>
        ) : (
          <View>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.body}>Why are you reporting this?</Text>
            <ScrollView style={styles.reasons} keyboardShouldPersistTaps="handled">
              {REPORT_REASONS.map((r) => (
                <Pressable
                  key={r}
                  style={[styles.reason, reason === r && styles.reasonSelected]}
                  onPress={() => setReason(r)}
                >
                  <Text style={[styles.reasonText, reason === r && styles.reasonTextSelected]}>{r}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <TextInput
              style={styles.details}
              placeholder="Anything else we should know? (optional)"
              placeholderTextColor={colors.textMuted}
              value={details}
              onChangeText={setDetails}
              multiline
              maxLength={1000}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable
              style={[styles.primaryBtn, (!reason || busy) && styles.btnDisabled]}
              onPress={send}
              disabled={!reason || busy}
            >
              {busy ? <ActivityIndicator color={colors.backgroundElevated} /> : <Text style={styles.primaryBtnText}>Send report</Text>}
            </Pressable>
            <Pressable style={styles.secondaryBtn} onPress={close} disabled={busy}>
              <Text style={styles.secondaryBtnText}>Cancel</Text>
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: colors.backgroundElevated,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.xl,
    paddingBottom: spacing.xl * 2,
  },
  title: { fontSize: 20, fontFamily: fontFamilies.frauncesRegular, color: colors.textPrimary, marginBottom: spacing.sm },
  body: { fontSize: 14, lineHeight: 20, fontFamily: fontFamilies.inter, color: colors.textSecondary, marginBottom: spacing.md },
  reasons: { maxHeight: 260 },
  reason: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  reasonSelected: { borderColor: colors.textPrimary, backgroundColor: colors.backgroundCanvas },
  reasonText: { fontSize: 14, fontFamily: fontFamilies.inter, color: colors.textPrimary },
  reasonTextSelected: { fontFamily: fontFamilies.interMedium },
  details: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.md,
    minHeight: 70,
    textAlignVertical: 'top',
    fontSize: 14,
    fontFamily: fontFamilies.inter,
    color: colors.textPrimary,
    marginTop: spacing.sm,
  },
  error: { color: colors.error, fontSize: 13, fontFamily: fontFamilies.inter, marginTop: spacing.sm },
  primaryBtn: {
    marginTop: spacing.lg,
    backgroundColor: colors.textPrimary,
    borderRadius: 12,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  primaryBtnText: { color: colors.backgroundElevated, fontSize: 15, fontFamily: fontFamilies.interMedium },
  btnDisabled: { opacity: 0.45 },
  secondaryBtn: { marginTop: spacing.sm, paddingVertical: spacing.md, alignItems: 'center' },
  secondaryBtnText: { color: colors.textSecondary, fontSize: 14, fontFamily: fontFamilies.inter },
})
