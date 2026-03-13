/**
 * Concierge Chat API — uses /api/concierge proxy when Search API URL is set (avoids Supabase->server timeout).
 * Falls back to concierge_chat Edge Function when no Search API URL.
 */

import { supabase } from './supabase'
import { config } from './config'

export async function sendConciergeMessage({ message, conversationHistory = [], userPreferences = null }) {
  const searchApiUrl = (config.searchApiUrl || '').replace(/\/$/, '')
  const supabaseUrl = config.supabaseUrl

  // Prefer concierge proxy when Search API URL is set (mobile can reach server directly; avoids Supabase->server timeout)
  if (searchApiUrl) {
    try {
      const res = await fetch(`${searchApiUrl}/api/concierge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: (message || '').trim(),
          conversationHistory: conversationHistory.map((m) => ({ role: m.role, content: m.content || '' })),
          userPreferences: userPreferences || null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        return { data: null, error: { message: data.error || 'Concierge request failed' } }
      }
      return {
        data: {
          response: data.response ?? '',
          reviews: data.reviews ?? [],
          venues: data.venues ?? [],
        },
        error: null,
      }
    } catch (err) {
      return { data: null, error: { message: err?.message || 'Network error' } }
    }
  }

  // Fallback: Edge Function (requires Supabase to reach SEARCH_API_URL)
  if (!supabaseUrl) return { data: null, error: { message: 'Not configured' } }
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token ?? config.supabaseAnonKey

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/concierge_chat`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: (message || '').trim(),
        conversationHistory: conversationHistory.map((m) => ({ role: m.role, content: m.content || '' })),
        userPreferences: userPreferences || null,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return { data: null, error: { message: data.error || 'Concierge request failed' } }
    }
    return {
      data: {
        response: data.response ?? '',
        reviews: data.reviews ?? [],
        venues: data.venues ?? [],
      },
      error: null,
    }
  } catch (err) {
    return { data: null, error: { message: err?.message || 'Network error' } }
  }
}
