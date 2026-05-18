/**
 * Shared onboarding chrome: back row, title block, scroll content insets.
 * Keeps Get Started / About You / Preferences headers aligned.
 */
import { StyleSheet } from 'react-native'
import { authColors, authFonts, authSpacing } from './authTheme'

export const ONBOARDING_MAX_WIDTH = 520

/** Base content style for onboarding ScrollViews (merge with extra padding e.g. keyboard). */
export function onboardingScrollContentBase(insets, extraBottom = 0) {
  return {
    paddingHorizontal: authSpacing.lg,
    // Stack header covers status bar; keep only the gap under the bar (same visual rhythm as pre-header insets+md).
    paddingTop: authSpacing.md,
    paddingBottom: insets.bottom + authSpacing.xl + extraBottom,
    maxWidth: ONBOARDING_MAX_WIDTH,
    width: '100%',
    alignSelf: 'center',
  }
}

export const onboardingHeaderStyles = StyleSheet.create({
  title: {
    fontFamily: authFonts.fraunces,
    fontSize: 40,
    lineHeight: 46,
    color: authColors.textPrimary,
    marginBottom: authSpacing.sm,
  },
  sub: {
    fontFamily: authFonts.inter,
    fontSize: 16,
    lineHeight: 22,
    color: authColors.textSecondary,
    marginBottom: authSpacing.xl,
  },
})
