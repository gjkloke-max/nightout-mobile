import { supabase } from '../lib/supabase'
import { validateUsernameFormat } from '../utils/mentions'

export async function checkUsernameAvailable(usernameNormalized, excludeUserId) {
  const v = validateUsernameFormat(usernameNormalized)
  if (!v.ok) return { available: false, error: v.error }
  if (!v.normalized) return { available: true }

  const { data, error } = await supabase.from('profiles').select('id').eq('username', v.normalized).maybeSingle()
  if (error && error.code !== 'PGRST116') return { available: false, error: error.message }
  if (!data?.id) return { available: true }
  if (excludeUserId && String(data.id) === String(excludeUserId)) return { available: true }
  return { available: false, error: 'That username is already taken.' }
}
