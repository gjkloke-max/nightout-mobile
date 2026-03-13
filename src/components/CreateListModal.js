import { useState } from 'react'
import {
  View,
  Text,
  Modal,
  Pressable,
  TextInput,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { SUGGESTED_LIST_NAMES } from '../utils/venueLists'
import { colors, fontSizes, fontWeights, spacing } from '../theme'

export default function CreateListModal({ isOpen, onClose, onCreate, loading }) {
  const [listName, setListName] = useState('')
  const [error, setError] = useState(null)

  const handleSubmit = async () => {
    const name = listName.trim()
    if (!name) {
      setError('Enter a list name')
      return
    }
    setError(null)
    const { error: createError } = await onCreate?.(name)
    if (createError) {
      setError(createError.message || 'Failed to create list')
      return
    }
    setListName('')
    onClose()
  }

  const handleSuggestionClick = (name) => {
    setListName(name)
    setError(null)
  }

  if (!isOpen) return null

  return (
    <Modal visible transparent animationType="fade">
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.content} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.title}>Create a list</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </View>
          <View style={styles.body}>
            <Text style={styles.label}>List name</Text>
            <TextInput
              style={styles.input}
              value={listName}
              onChangeText={(t) => { setListName(t); setError(null) }}
              placeholder="e.g. Date Night Spots"
              maxLength={100}
              autoFocus
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <View style={styles.suggestions}>
              <Text style={styles.suggestionsLabel}>Suggestions</Text>
              <View style={styles.chips}>
                {SUGGESTED_LIST_NAMES.map((name) => (
                  <Pressable
                    key={name}
                    style={[styles.chip, listName === name && styles.chipSelected]}
                    onPress={() => handleSuggestionClick(name)}
                  >
                    <Text style={[styles.chipText, listName === name && styles.chipTextSelected]}>
                      {name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
          <View style={styles.footer}>
            <Pressable style={styles.btnSecondary} onPress={onClose}>
              <Text style={styles.btnSecondaryText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.btnPrimary, (loading || !listName.trim()) && styles.btnDisabled]}
              onPress={handleSubmit}
              disabled={loading || !listName.trim()}
            >
              {loading ? (
                <ActivityIndicator size="small" color={colors.textOnDark} />
              ) : (
                <Text style={styles.btnPrimaryText}>Create list</Text>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  content: {
    backgroundColor: colors.backgroundElevated,
    borderRadius: 12,
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  title: { fontSize: fontSizes.xl, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  closeBtn: { padding: spacing.sm },
  closeText: { fontSize: 28, color: colors.textMuted },
  body: { padding: spacing.base },
  label: { fontSize: fontSizes.sm, color: colors.textSecondary, marginBottom: spacing.xs },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    fontSize: fontSizes.base,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  error: { fontSize: fontSizes.sm, color: colors.error, marginBottom: spacing.sm },
  suggestions: { marginBottom: spacing.lg },
  suggestionsLabel: { fontSize: fontSizes.sm, color: colors.textSecondary, marginBottom: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipSelected: { backgroundColor: colors.accentMuted, borderColor: colors.accent },
  chipText: { fontSize: fontSizes.sm, color: colors.textPrimary },
  chipTextSelected: { color: colors.accent, fontWeight: fontWeights.semibold },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.base,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  btnSecondary: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  btnSecondaryText: { fontSize: fontSizes.base, color: colors.textPrimary },
  btnPrimary: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    backgroundColor: colors.accent,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  btnPrimaryText: { fontSize: fontSizes.base, color: colors.textOnDark, fontWeight: '600' },
})
