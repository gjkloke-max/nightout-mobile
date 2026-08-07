/**
 * Shared neighborhood key normalization for location parsing.
 */

export function canonicalNeighborhoodKey(name) {
  return String(name || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ')
}
