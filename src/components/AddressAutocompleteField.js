import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet } from 'react-native'
import { authColors, authFonts, authSpacing } from '../theme/authTheme'

/**
 * Address line + optional prediction list (parent loads predictions).
 */
export default function AddressAutocompleteField({
  value,
  onChangeText,
  placeholder,
  placeholderTextColor,
  predictions = [],
  predictionsLoading = false,
  onSelectPrediction,
  multiline = false,
  minHeight = 88,
  testID,
}) {
  return (
    <View style={styles.wrap}>
      <TextInput
        testID={testID}
        style={[styles.input, multiline ? { minHeight, textAlignVertical: 'top' } : null]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={placeholderTextColor || authColors.textMuted}
        multiline={multiline}
        autoCorrect={false}
      />
      {predictionsLoading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={authColors.accent} />
          <Text style={styles.loadingHint}>Looking up addresses…</Text>
        </View>
      ) : null}
      {predictions.length > 0 ? (
        <View style={styles.dropdown}>
          {predictions.map((p) => (
            <Pressable
              key={p.placeId}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => onSelectPrediction(p)}
            >
              <Text style={styles.rowText} numberOfLines={2}>
                {p.description}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { marginBottom: authSpacing.md, zIndex: 1 },
  input: {
    borderWidth: 1,
    borderColor: authColors.border,
    paddingHorizontal: authSpacing.md,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: authFonts.inter,
    color: authColors.textPrimary,
    backgroundColor: authColors.surface,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: authSpacing.sm,
    marginTop: authSpacing.xs,
  },
  loadingHint: { fontFamily: authFonts.inter, fontSize: 13, color: authColors.textSecondary },
  dropdown: {
    marginTop: authSpacing.xs,
    borderWidth: 1,
    borderColor: authColors.border,
    backgroundColor: authColors.surface,
    maxHeight: 220,
  },
  row: {
    paddingVertical: authSpacing.sm,
    paddingHorizontal: authSpacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: authColors.border,
  },
  rowPressed: { backgroundColor: 'rgba(157, 23, 77, 0.06)' },
  rowText: { fontFamily: authFonts.inter, fontSize: 15, color: authColors.textPrimary },
})
