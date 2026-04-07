/** @param {string} text */
export function extractMentionTokens(text) {
  if (!text || typeof text !== 'string') return []
  const out = new Set()
  const re = /@([a-z0-9_]{3,30})\b/gi
  let m
  while ((m = re.exec(text)) !== null) {
    const t = (m[1] || '').toLowerCase()
    if (t.length >= 3 && t.length <= 30) out.add(t)
  }
  return [...out]
}

export function validateUsernameFormat(raw) {
  const s = (raw || '').trim().toLowerCase()
  if (!s.length) return { ok: true, normalized: '' }
  if (s.length < 3 || s.length > 30) return { ok: false, error: 'Username must be 3–30 characters.' }
  if (!/^[a-z0-9_]+$/.test(s)) return { ok: false, error: 'Use letters, numbers, and underscores only.' }
  return { ok: true, normalized: s }
}
