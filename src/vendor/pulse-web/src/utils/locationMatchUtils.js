/**
 * Shared location phrase matching helpers (browser + Node).
 */

/**
 * @param {string} query
 * @param {string} communityAreaLower
 * @param {Iterable<string>} microNames
 */
export function isCommunityMatchSubsumedByMicro(query, communityAreaLower, microNames) {
  const q = String(query || '').trim()
  if (!q || !communityAreaLower) return false
  for (const name of microNames) {
    const microLower = String(name || '').trim().toLowerCase()
    if (!microLower.includes(communityAreaLower) || microLower.length <= communityAreaLower.length) continue
    const re = new RegExp(`\\b${microLower.replace(/\s+/g, '\\s+')}\\b`, 'i')
    if (re.test(q)) return true
  }
  return false
}
