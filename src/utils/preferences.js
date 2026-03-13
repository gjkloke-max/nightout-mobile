import { supabase } from '../lib/supabase'

export async function getGroupedPreferences() {
  if (!supabase) return { categories: [], preferences: [] }
  const { data: categories, error: catErr } = await supabase
    .from('preference_category')
    .select('preference_category_id, name, slug, max_selections, sort_order')
    .order('sort_order', { ascending: true })
  if (catErr) return { categories: [], preferences: [] }
  const { data: preferences, error: prefErr } = await supabase
    .from('preference_master')
    .select('preference_master_id, preference_name, preference_category_id, is_hard_constraint')
    .not('preference_category_id', 'is', null)
    .order('preference_name', { ascending: true })
  if (prefErr) return { categories: categories || [], preferences: [] }
  return { categories: categories || [], preferences: preferences || [] }
}

export async function getUserPreferenceIds(userId) {
  if (!userId || !supabase) return []
  const { data, error } = await supabase
    .from('user_preference')
    .select('preference_master_id')
    .eq('user_id', userId)
  if (error) return []
  return (data || []).map((r) => r.preference_master_id)
}

export async function saveUserPreferences(userId, preferenceIds) {
  if (!userId || !supabase) return { success: false, error: 'User ID required' }
  const ids = [...new Set(preferenceIds)].filter((id) => id != null)
  const { error: delErr } = await supabase.from('user_preference').delete().eq('user_id', userId)
  if (delErr) return { success: false, error: delErr.message }
  if (ids.length === 0) return { success: true }
  const { error: insErr } = await supabase
    .from('user_preference')
    .insert(ids.map((preference_master_id) => ({ user_id: userId, preference_master_id })))
  if (insErr) return { success: false, error: insErr.message }
  return { success: true }
}
