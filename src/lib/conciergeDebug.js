/**
 * Concierge debug flag — mirrors web localStorage `conciergeDebug=1`.
 * Set EXPO_PUBLIC_CONCIERGE_DEBUG=true in .env to enable on mobile.
 */
export function isConciergeDebugEnabled() {
  return process.env.EXPO_PUBLIC_CONCIERGE_DEBUG === 'true'
}
