/**
 * Suburban / exurban place names that should not appear as "nearby" to a Chicago
 * community-area search when geography is inferred from neighborhood_name only.
 * Lowercase keys; matching is case-insensitive on the trimmed string.
 */
const SUBURB_EXCLUSION = new Set([
  'rosemont',
  'park ridge',
  'parkridge',
  'schaumburg',
  'oak brook',
  'oakbrook',
  'naperville',
  'arlington heights',
  'elk grove village',
  'des plaines',
  'mount prospect',
  'wheeling',
  'northbrook',
  'glenview',
  'wilmette',
  'winnetka',
  'evanston',
  'skokie',
  'lincolnwood',
  'alsip',
  'norridge',
  'harwood heights',
  'schiller park',
  'franklin park',
  'bensenville',
  'itasca',
  'elmhurst',
  'downers grove',
  'lombard',
  'villa park',
  'addison',
  'bolingbrook',
  'aurora',
  'joliet',
  'plainfield',
  'romeoville',
  'orland park',
  'tinley park',
  'oak lawn',
  'palatine',
  'hoffman estates',
  'streamwood',
  'hanover park',
  'bartlett',
  'carol stream',
  'glendale heights',
  'bloomingdale',
  'mundelein',
  'vernon hills',
  'libertyville',
  'lake forest',
  'highland park',
  'deerfield',
  'northfield',
  'kenilworth',
  'glencoe',
  'morton grove',
  'niles',
])

/**
 * @param {string|null|undefined} raw
 * @returns {boolean}
 */
export function isExcludedSuburbName(raw) {
  if (!raw || typeof raw !== 'string') return false
  const n = raw.toLowerCase().trim()
  if (SUBURB_EXCLUSION.has(n)) return true
  const comma = n.indexOf(',')
  const head = (comma >= 0 ? n.slice(0, comma) : n).trim()
  if (SUBURB_EXCLUSION.has(head)) return true
  return false
}
