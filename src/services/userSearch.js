/**
 * Search users for social discovery
 */

import { supabase } from '../lib/supabase'

function rankMentionResults(needle, rows) {
  const n = (needle || '').toLowerCase()
  const scored = rows.map((r) => {
    const un = (r.username || '').toLowerCase()
    const fn = (r.first_name || '').toLowerCase()
    const ln = (r.last_name || '').toLowerCase()
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
    const fullName = `${fn} ${ln}`.trim()
    if (fullName.includes(n)) score += 10
    return { row: r, score }
  })
  scored.sort((a, b) => b.score - a.score || (a.row.username || '').localeCompare(b.row.username || ''))
  return scored.map((x) => x.row)
}

export async function searchUsers(currentUserId, searchTerm, limit = 20) {
  const trimmed = (searchTerm || '').trim()
  if (trimmed.length < 2) return []
  const esc = trimmed.replace(/%/g, '\\%').replace(/_/g, '\\_')
  let query = supabase
    .from('profiles')
    .select('id, first_name, last_name, avatar_url, username')
    .or(`username.ilike.%${esc}%,first_name.ilike.%${esc}%,last_name.ilike.%${esc}%`)
    .limit(60)
  if (currentUserId) query = query.neq('id', currentUserId)
  const { data } = await query
  return rankMentionResults(trimmed, data || []).slice(0, limit)
}
