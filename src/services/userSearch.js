/**
 * Search users for social discovery
 */

import { supabase } from '../lib/supabase'

function escapeIlike(term) {
  return String(term || '').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

function splitSearchTokens(searchTerm) {
  return String(searchTerm || '')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
}

function profileMatchesAllTokens(row, tokens) {
  if (!tokens.length) return false
  const fn = (row.first_name || '').toLowerCase()
  const ln = (row.last_name || '').toLowerCase()
  const un = (row.username || '').toLowerCase()
  const fullName = `${fn} ${ln}`.trim()
  const blob = [un, fn, ln, fullName].filter(Boolean).join(' ')

  return tokens.every((tok) => {
    if (!tok) return false
    if (blob.includes(tok)) return true
    return fn.startsWith(tok) || ln.startsWith(tok) || un.startsWith(tok)
  })
}

function rankMentionResults(needle, rows) {
  const tokens = splitSearchTokens(needle)
  const n = tokens.join(' ')
  const scored = rows.map((r) => {
    const un = (r.username || '').toLowerCase()
    const fn = (r.first_name || '').toLowerCase()
    const ln = (r.last_name || '').toLowerCase()
    const fullName = `${fn} ${ln}`.trim()
    let score = 0
    if (un) {
      if (un === n) score += 200
      else if (un.startsWith(n)) score += 120
      else if (un.includes(n)) score += 80
    }
    if (fn.startsWith(n)) score += 60
    else if (fn.includes(n)) score += 35
    if (ln.startsWith(n)) score += 55
    else if (ln.includes(n)) score += 30
    if (fullName.includes(n)) score += 40
    if (tokens.length > 1 && profileMatchesAllTokens(r, tokens)) {
      score += 50
      if (tokens[0] && fn.startsWith(tokens[0])) score += 25
      if (tokens.length > 1 && tokens[1] && ln.startsWith(tokens[1])) score += 25
    }
    return { row: r, score }
  })
  scored.sort((a, b) => b.score - a.score || (a.row.username || '').localeCompare(b.row.username || ''))
  return scored.map((x) => x.row)
}

export async function searchUsers(currentUserId, searchTerm, limit = 20) {
  const trimmed = (searchTerm || '').trim()
  if (trimmed.length < 2) return []
  const tokens = splitSearchTokens(trimmed)
  if (!tokens.length) return []

  const orParts = []
  for (const token of tokens) {
    const esc = escapeIlike(token)
    orParts.push(
      `username.ilike.%${esc}%`,
      `first_name.ilike.%${esc}%`,
      `last_name.ilike.%${esc}%`,
    )
  }

  let query = supabase
    .from('profiles')
    .select('id, first_name, last_name, avatar_url, username')
    .or(orParts.join(','))
    .limit(60)

  if (currentUserId) query = query.neq('id', currentUserId)

  const { data } = await query
  const filtered = (data || []).filter((row) => profileMatchesAllTokens(row, tokens))
  return rankMentionResults(trimmed, filtered).slice(0, limit)
}

export { splitSearchTokens, profileMatchesAllTokens, rankMentionResults }
