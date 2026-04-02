/**
 * Concierge routing:
 * - When EXPO_PUBLIC_SEARCH_API_URL is set: Pulse Node `POST …/api/concierge` by default (same stack as Browse /api/search).
 * - Edge `concierge_chat` only if EXPO_PUBLIC_USE_CONCIERGE_EDGE_FUNCTION === 'true'.
 * - When SEARCH_API_URL is unset: Supabase Edge is the fallback (unless EXPO_PUBLIC_USE_CONCIERGE_EDGE_FUNCTION=false in prod).
 */

import { Platform } from 'react-native'
import { supabase } from './supabase'
import { config } from './config'

/** Android emulator maps host “localhost” to the dev machine via 10.0.2.2 */
function resolveSearchApiBaseUrl(url) {
  const trimmed = (url || '').replace(/\/$/, '')
  if (!trimmed || !__DEV__ || Platform.OS !== 'android') return trimmed
  return trimmed.replace(
    /^(https?:\/\/)(127\.0\.0\.1|localhost)(:\d+)?$/i,
    (_, proto, _host, port) => `${proto}10.0.2.2${port ?? ''}`
  )
}

async function fetchWithTimeout(url, options = {}, timeoutMs) {
  const ms = timeoutMs ?? config.conciergeTimeoutMs
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), ms)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(id)
  }
}

function conciergeFetchError(err) {
  if (err?.name === 'AbortError') {
    return {
      message:
        'Concierge is taking longer than usual. Check your connection or try again — if this keeps happening, the server may need a higher proxy timeout for /api/concierge.',
    }
  }
  return { message: err?.message || 'Network error' }
}

/**
 * Prefer Pulse Node when SEARCH_API_URL is configured (typical production).
 * Opt in to Edge with EXPO_PUBLIC_USE_CONCIERGE_EDGE_FUNCTION=true.
 * Without SEARCH_API_URL, Edge remains the default path (unless explicitly disabled in prod).
 */
function useConciergeEdgeFunction() {
  const v = process.env.EXPO_PUBLIC_USE_CONCIERGE_EDGE_FUNCTION
  const hasSearchUrl = !!(config.searchApiUrl || '').trim()
  if (hasSearchUrl) {
    return v === 'true'
  }
  if (__DEV__) {
    return v === 'true'
  }
  return v !== 'false'
}

async function postConciergeEdge({
  message,
  conversationHistory,
  userPreferences,
}) {
  const supabaseUrl = config.supabaseUrl
  if (__DEV__) {
    console.log(
      '[concierge] using Supabase Edge (concierge_chat). For local Pulse/ParadeDB, set EXPO_PUBLIC_SEARCH_API_URL and do not set EXPO_PUBLIC_USE_CONCIERGE_EDGE_FUNCTION=true.'
    )
  }
  if (!supabaseUrl) return { data: null, error: { message: 'Not configured' } }
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const token = session?.access_token ?? config.supabaseAnonKey

  try {
    const res = await fetchWithTimeout(`${supabaseUrl}/functions/v1/concierge_chat`, {
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
    return { data: null, error: conciergeFetchError(err) }
  }
}

export async function sendConciergeMessage({
  message,
  conversationHistory = [],
  userPreferences = null,
  userHome = null,
  excludeVenueIds = [],
}) {
  const searchApiUrl = resolveSearchApiBaseUrl((config.searchApiUrl || '').replace(/\/$/, ''))

  if (__DEV__ && searchApiUrl && /localhost|127\.0\.0\.1/i.test(searchApiUrl)) {
    console.warn(
      '[concierge] EXPO_PUBLIC_SEARCH_API_URL points at localhost. On a physical phone, use your PC’s LAN IP (e.g. http://192.168.1.x:3001). iOS Simulator and Android emulator are OK with localhost (emulator uses 10.0.2.2).'
    )
  }

  const edgeFirst = useConciergeEdgeFunction()

  if (__DEV__ && !edgeFirst && !searchApiUrl) {
    return {
      data: null,
      error: {
        message:
          'Local dev: set EXPO_PUBLIC_SEARCH_API_URL to your computer’s LAN IP and port (e.g. http://192.168.1.5:3001). On a physical phone, localhost is the phone itself, not your PC. Android emulator: use http://10.0.2.2:3001 or we rewrite localhost automatically. To test the Edge Function instead, set EXPO_PUBLIC_USE_CONCIERGE_EDGE_FUNCTION=true (Supabase must be able to reach SEARCH_API_URL).',
      },
    }
  }

  if (!__DEV__ && process.env.EXPO_PUBLIC_USE_CONCIERGE_EDGE_FUNCTION === 'false' && !searchApiUrl) {
    return {
      data: null,
      error: {
        message:
          'Set EXPO_PUBLIC_SEARCH_API_URL for Node /api/concierge, or remove EXPO_PUBLIC_USE_CONCIERGE_EDGE_FUNCTION=false to use the Supabase Edge Function (default, matches web).',
      },
    }
  }

  if (edgeFirst) {
    return postConciergeEdge({
      message,
      conversationHistory,
      userPreferences,
    })
  }

  // Node /api/concierge — default when SEARCH_API_URL is set; Edge only if EXPO_PUBLIC_USE_CONCIERGE_EDGE_FUNCTION=true
  if (searchApiUrl) {
    if (__DEV__) {
      console.log('[concierge] using Pulse Node', `${searchApiUrl}/api/concierge`)
    }
    try {
      const body = {
        message: (message || '').trim(),
        conversationHistory: conversationHistory.map((m) => ({ role: m.role, content: m.content || '' })),
        userPreferences: userPreferences || null,
      }
      if (userHome && (userHome.lat != null || userHome.lng != null)) {
        body.userHome = {
          homeNeighborhoodName: userHome.homeNeighborhoodName ?? null,
          lat: userHome.lat ?? null,
          lng: userHome.lng ?? null,
        }
      }
      if (Array.isArray(excludeVenueIds) && excludeVenueIds.length > 0) {
        body.excludeVenueIds = excludeVenueIds
      }
      const res = await fetchWithTimeout(`${searchApiUrl}/api/concierge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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
      return { data: null, error: conciergeFetchError(err) }
    }
  }

  return { data: null, error: { message: 'Concierge not configured' } }
}
