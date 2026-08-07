/** @param {unknown} id */
export function normalizeVenueId(id) {
  if (id == null || id === '') return null
  const n = parseInt(String(id), 10)
  return Number.isNaN(n) ? null : n
}
