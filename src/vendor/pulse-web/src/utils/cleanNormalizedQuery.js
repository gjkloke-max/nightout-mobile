/**
 * Clean normalized search query after extracting locations, protected phrases, etc.
 */

function norm(s) {
  return (s || '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.!?;:])/g, '$1')
    .trim()
}

/**
 * @param {string} query
 * @returns {string}
 */
export function cleanNormalizedQuery(query) {
  let q = norm(query)
  if (!q) return ''

  // Remove dangling location prepositions and connectors
  q = q.replace(/\b(?:in|near|around|within|by)\s*$/i, '')
  q = q.replace(/\b(?:or|and)\s*$/i, '')
  q = q.replace(/,\s*(?:or|and)\s*$/i, '')
  q = q.replace(/,\s*$/g, '')
  q = q.replace(/\s{2,}/g, ' ')
  q = q.replace(/^\s*(?:or|and)\s+/i, '')
  q = q.replace(/\s+(?:or|and)\s*$/i, '')

  // Collapse duplicate commas / empty slots
  q = q.replace(/,\s*,+/g, ', ')
  q = q.replace(/\(\s*\)/g, '')
  q = norm(q)

  return q
}
