/**
 * Shared text presets — use for hierarchy consistency across screens.
 * Pair with local styles for one-off layout; prefer these for repeated patterns.
 */
import { StyleSheet } from 'react-native'
import { colors } from './colors'
import { fontFamilies, fontSizes, fontWeights } from './typography'

export const textStyles = StyleSheet.create({
  /** Screen titles (custom headers) — Fraunces 24 */
  screenTitle: {
    fontFamily: fontFamilies.frauncesSemiBold,
    fontSize: fontSizes['2xl'],
    lineHeight: 32,
    color: colors.textPrimary,
  },
  /** Section / list section caps — Inter uppercase */
  sectionLabel: {
    fontFamily: fontFamilies.interSemiBold,
    fontSize: fontSizes.micro,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: colors.textTag,
  },
  /** Primary body */
  body: {
    fontFamily: fontFamilies.inter,
    fontSize: fontSizes.base,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  bodyMuted: {
    fontFamily: fontFamilies.inter,
    fontSize: fontSizes.sm,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  /** Timestamps, secondary meta */
  caption: {
    fontFamily: fontFamilies.inter,
    fontSize: fontSizes.xs,
    lineHeight: 16,
    color: colors.textMuted,
  },
  /** Empty states */
  emptyTitle: {
    fontFamily: fontFamilies.frauncesSemiBold,
    fontSize: fontSizes.xl,
    lineHeight: 28,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontFamily: fontFamilies.inter,
    fontSize: fontSizes.sm,
    lineHeight: 22,
    color: colors.textSecondary,
    textAlign: 'center',
  },
})
