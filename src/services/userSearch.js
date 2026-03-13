/**
 * Search users by display name for social discovery (profiles by first_name/last_name)
 */

import { supabase } from '../lib/supabase'

export async function searchUsers(currentUserId, searchTerm, limit = 20) {
  const trimmed = (searchTerm || '').trim()
  if (trimmed.length < 2) return []

  let query = supabase
    .from('profiles')
    .select('id, first_name, last_name, avatar_url')
    .or(`first_name.ilike.%${trimmed}%,last_name.ilike.%${trimmed}%`)
    .limit(limit)

  if (currentUserId) {
    query = query.neq('id', currentUserId)
  }

  const { data } = await query
  return data || []
}
