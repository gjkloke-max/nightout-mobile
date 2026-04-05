/**
 * Consistent touch feedback and hit areas (iOS HIG ~44pt minimum).
 */

export const pressOpacity = {
  default: 0.85,
  subtle: 0.92,
}

/** Expand tappable area for icon-only controls */
export const hitSlop = {
  sm: { top: 8, bottom: 8, left: 8, right: 8 },
  md: { top: 12, bottom: 12, left: 12, right: 12 },
}

/** Minimum touch target (points) — use minWidth/minHeight on wrappers */
export const touchTarget = {
  min: 44,
}

/** Android ripple for Pressable list rows / icon buttons */
export const androidRipple = {
  light: { color: 'rgba(24, 24, 27, 0.06)', borderless: false },
  medium: { color: 'rgba(24, 24, 27, 0.1)', borderless: false },
}
