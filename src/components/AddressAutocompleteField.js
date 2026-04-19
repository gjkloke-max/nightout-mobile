import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  Platform,
  Keyboard,
} from 'react-native'
import { MapPin } from 'lucide-react-native'
import { authColors, authFonts, authSpacing } from '../theme/authTheme'

/**
 * Address search input + suggestions; styled as one bordered control (onboarding / settings).
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
  minHeight,
  testID,
  onInputFocus,
  onInputBlur,
}) {
  const [focused, setFocused] = useState(false)
  const open = predictions.length > 0
  const showLoader = predictionsLoading && !open

  const inputMinH = multiline ? minHeight ?? 88 : minHeight ?? 52

  return (
    <View style={styles.outer}>
      <View
        style={[
          styles.chrome,
          focused && styles.chromeFocused,
          (open || showLoader) && styles.chromeRoundedBottom,
        ]}
      >
        <TextInput
          testID={testID}
          style={[
            styles.input,
            multiline ? { minHeight: inputMinH, textAlignVertical: 'top', paddingTop: 14 } : { minHeight: inputMinH },
            open && styles.inputOpenBottom,
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={placeholderTextColor || authColors.textMuted}
          multiline={multiline}
          autoCorrect={false}
          returnKeyType="done"
          blurOnSubmit
          onSubmitEditing={() => Keyboard.dismiss()}
          onFocus={() => {
            setFocused(true)
            onInputFocus?.()
          }}
          onBlur={() => {
            setFocused(false)
            onInputBlur?.()
          }}
        />

        {showLoader ? (
          <View style={styles.loadingInset}>
            <ActivityIndicator size="small" color={authColors.accent} />
            <Text style={styles.loadingHint}>Searching addresses…</Text>
          </View>
        ) : null}

        {open ? (
          <>
            <View style={styles.divider} />
            <ScrollView
              style={styles.dropdownScroll}
              contentContainerStyle={styles.dropdownContent}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              showsVerticalScrollIndicator={predictions.length > 4}
            >
              {predictions.map((p) => (
                <Pressable
                  key={p.placeId}
                  style={({ pressed }) => [styles.suggestionRow, pressed && styles.suggestionPressed]}
                  onPress={() => {
                    Keyboard.dismiss()
                    onSelectPrediction(p)
                  }}
                >
                  <MapPin size={18} color={authColors.textMuted} style={styles.pinIcon} strokeWidth={2} />
                  <Text style={styles.suggestionText} numberOfLines={2}>
                    {p.description}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  outer: { width: '100%' },
  chrome: {
    width: '100%',
    borderWidth: 1,
    borderColor: authColors.border,
    backgroundColor: authColors.surface,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
      },
      android: { elevation: 2 },
    }),
  },
  chromeRoundedBottom: {
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
      },
      android: { elevation: 6 },
    }),
  },
  chromeFocused: {
    borderColor: authColors.accent,
    ...Platform.select({
      ios: { shadowOpacity: 0.1 },
      android: { elevation: 3 },
    }),
  },
  input: {
    paddingHorizontal: authSpacing.md,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: authFonts.inter,
    color: authColors.textPrimary,
    backgroundColor: 'transparent',
  },
  inputOpenBottom: {
    paddingBottom: 12,
  },
  loadingInset: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: authSpacing.sm,
    paddingHorizontal: authSpacing.md,
    paddingBottom: authSpacing.sm,
  },
  loadingHint: {
    fontFamily: authFonts.inter,
    fontSize: 13,
    color: authColors.textSecondary,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: authColors.border,
    marginHorizontal: authSpacing.md,
  },
  dropdownScroll: {
    maxHeight: 240,
  },
  dropdownContent: {
    paddingBottom: authSpacing.xs,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: authSpacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: authColors.border,
  },
  suggestionPressed: { backgroundColor: 'rgba(157, 23, 77, 0.06)' },
  pinIcon: { marginRight: 12 },
  suggestionText: {
    flex: 1,
    fontFamily: authFonts.inter,
    fontSize: 15,
    lineHeight: 20,
    color: authColors.textPrimary,
  },
})
