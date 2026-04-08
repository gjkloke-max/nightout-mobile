export function validateUsernameFormat(raw) {
  const s = (raw || '').trim().toLowerCase()
  if (!s.length) return { ok: true, normalized: '' }
  if (s.length < 3 || s.length > 30) return { ok: false, error: 'Username must be 3–30 characters.' }
  if (!/^[a-z0-9_]+$/.test(s)) return { ok: false, error: 'Use letters, numbers, and underscores only.' }
  return { ok: true, normalized: s }
}
