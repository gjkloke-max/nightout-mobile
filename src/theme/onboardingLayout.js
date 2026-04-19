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
    paddingTop: insets.top + authSpacing.md,
    paddingBottom: insets.bottom + authSpacing.xl + extraBottom,
    maxWidth: ONBOARDING_MAX_WIDTH,
    width: '100%',
    alignSelf: 'center',
  }
}

export const onboardingHeaderStyles = StyleSheet.create({
  backWrap: { alignSelf: 'flex-start', marginBottom: authSpacing.lg, zIndex: 20 },
  backRow: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  backChevron: { marginRight: 4 },
  back: { fontFamily: authFonts.interMedium, fontSize: 14, color: authColors.textPrimary },
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
