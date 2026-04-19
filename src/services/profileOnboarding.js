import { supabase } from '../lib/supabase'

export const ONBOARDING_STEP = {
  GET_STARTED: 'get_started',
  ABOUT_YOU: 'about_you',
  PREFERENCES: 'preferences',
  COMPLETE: 'complete',
}

/**
 * @param {string} userId
 * @returns {Promise<object|null>}
 */
export async function fetchProfileRow(userId) {
  if (!supabase || !userId) return null
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
  if (error) {
    console.warn('fetchProfileRow', error)
    return null
  }
  return data
}

/**
 * Create or patch profile after auth (OAuth prefills when provided).
 * @param {import('@supabase/supabase-js').User} user
 * @param {{ firstName?: string, lastName?: string, avatarUrl?: string }} [prefill]
 */
export async function ensureProfileAfterAuth(user, prefill = {}) {
  if (!supabase || !user?.id) return null

  const provider = user.app_metadata?.provider || user.identities?.[0]?.provider || 'email'
  const isOAuth = provider === 'google' || provider === 'apple'

  const existing = await fetchProfileRow(user.id)
  if (existing) {
    const incomplete = existing.onboarding_completed !== true
    const step = existing.onboarding_step
    const atGetStarted =
      step === ONBOARDING_STEP.GET_STARTED || step === 'get_started' || step == null || step === ''
    if (isOAuth && incomplete && atGetStarted) {
      const { error } = await supabase
        .from('profiles')
        .update({
          onboarding_step: ONBOARDING_STEP.ABOUT_YOU,
          auth_provider: provider,
          email: user.email ?? existing.email,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)
      if (error) console.warn('ensureProfileAfterAuth oauth resume', error)
      return fetchProfileRow(user.id)
    }
    return existing
  }

  const meta = user.user_metadata || {}
  const full = (meta.full_name || meta.name || '').trim()
  let firstName = prefill.firstName || meta.first_name || ''
  let lastName = prefill.lastName || meta.last_name || ''
  if (!firstName && full) {
    const parts = full.split(/\s+/)
    firstName = parts[0] || ''
    lastName = parts.slice(1).join(' ') || ''
  }

  const row = {
    id: user.id,
    email: user.email || null,
    auth_provider: provider,
    onboarding_completed: false,
    onboarding_step: ONBOARDING_STEP.ABOUT_YOU,
    first_name: firstName || null,
    last_name: lastName || null,
    avatar_url: prefill.avatarUrl || meta.avatar_url || meta.picture || null,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase.from('profiles').insert(row)
  if (error && error.code !== '23505') {
    console.warn('ensureProfileAfterAuth insert', error)
    const again = await fetchProfileRow(user.id)
    return again
  }
  return fetchProfileRow(user.id)
}

export async function updateOnboardingStep(userId, step) {
  if (!supabase || !userId) return { success: false }
  const { error } = await supabase
    .from('profiles')
    .update({ onboarding_step: step, updated_at: new Date().toISOString() })
    .eq('id', userId)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function completeOnboarding(userId) {
  if (!supabase || !userId) return { success: false }
  const { error } = await supabase
    .from('profiles')
    .update({
      onboarding_completed: true,
      onboarding_step: ONBOARDING_STEP.COMPLETE,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
  if (error) return { success: false, error: error.message }
  return { success: true }
}
