/**
 * US-style display: 763-439-2450; store digits only (10) in profile.
 */

export function normalizeUsPhoneDigits(input) {
  let d = String(input || '').replace(/\D/g, '')
  if (d.length === 11 && d.startsWith('1')) d = d.slice(1)
  return d.slice(0, 10)
}

export function formatUsPhoneDisplayFromDigits(digits) {
  const d = normalizeUsPhoneDigits(digits)
  if (d.length === 0) return ''
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}-${d.slice(3)}`
  return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`
}

/** For profile / API: 10-digit string or empty */
export function phoneDigitsForStorage(displayOrRaw) {
  const d = normalizeUsPhoneDigits(displayOrRaw)
  return d.length === 10 ? d : ''
}
