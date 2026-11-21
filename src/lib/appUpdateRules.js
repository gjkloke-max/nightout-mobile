/**
 * The rules behind the update prompt. No imports, so the decisions can be checked on their own.
 *
 * The numbers come from one row of `public.app_release_config` for this platform:
 *   min_build          builds below this cannot be used until they update
 *   recommended_build  builds below this are asked to update, and may decline
 * A build is the store build number: iOS buildNumber, Android versionCode.
 */

/** How long a declined "update available" prompt stays quiet before it is shown again. */
export const UPDATE_SNOOZE_MS = 3 * 24 * 60 * 60 * 1000

const toBuild = (v) => {
  const n = typeof v === 'number' ? v : parseInt(String(v ?? '').trim(), 10)
  return Number.isInteger(n) && n > 0 ? n : null
}

/**
 * What this build should be told.
 *
 * Anything missing or unreadable means "none": a row that was never filled in, a build number this
 * app cannot read, a failed request. The prompt must never be the reason someone cannot use the app.
 *
 * @param {{ build: unknown, config: { min_build?: unknown, recommended_build?: unknown }|null|undefined }} p
 * @returns {'required'|'available'|'none'}
 */
export function decideUpdate({ build, config }) {
  const mine = toBuild(build)
  if (mine == null || !config) return 'none'
  const min = toBuild(config.min_build)
  const recommended = toBuild(config.recommended_build)
  if (min != null && mine < min) return 'required'
  if (recommended != null && mine < recommended) return 'available'
  return 'none'
}

/**
 * Whether a declined "update available" prompt should stay hidden for now.
 * It comes back after the snooze, or at once when a newer build is recommended than the one declined.
 *
 * @param {{ dismissed: { build?: unknown, at?: unknown }|null|undefined, recommendedBuild: unknown, now?: number }} p
 */
export function isSnoozed({ dismissed, recommendedBuild, now = Date.now() }) {
  const declined = toBuild(dismissed?.build)
  const at = Number(dismissed?.at)
  const recommended = toBuild(recommendedBuild)
  if (declined == null || !Number.isFinite(at) || recommended == null) return false
  if (recommended > declined) return false
  return now - at < UPDATE_SNOOZE_MS
}

/**
 * The store page to open. A `store_url` in the config row wins, so the link can be changed without
 * a new build; otherwise the page is built from the app's own identifiers.
 *
 * @param {{ platform: string, config?: { store_url?: string|null }|null, iosAppId?: string, androidPackage?: string }} p
 * @returns {string|null}
 */
export function storeUrlFor({ platform, config, iosAppId, androidPackage }) {
  const override = String(config?.store_url || '').trim()
  if (/^https:\/\//i.test(override)) return override
  if (platform === 'ios' && iosAppId) return `https://apps.apple.com/app/id${iosAppId}`
  if (platform === 'android' && androidPackage) return `https://play.google.com/store/apps/details?id=${androidPackage}`
  return null
}
