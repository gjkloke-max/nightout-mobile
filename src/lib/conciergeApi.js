/**
 * Concierge: Pulse Node `POST …/api/concierge` only (OpenAI + ParadeDB on server).
 * Set EXPO_PUBLIC_SEARCH_API_URL to the same base as Browse search (e.g. http://host:3001).
 */

import { Platform } from 'react-native'
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

export async function sendConciergeMessage({
  message,
  conversationHistory = [],
  userPreferences = null,
  userHome = null,
  excludeVenueIds = [],
}) {
  const searchApiUrl = resolveSearchApiBaseUrl((config.searchApiUrl || '').replace(/\/$/, ''))

  if (!searchApiUrl) {
    return {
      data: null,
      error: {
        message:
          'Set EXPO_PUBLIC_SEARCH_API_URL to your Pulse Node search API (same host/port as /api/search), e.g. http://192.168.1.5:3001 on a physical device.',
      },
    }
  }

  if (__DEV__ && /localhost|127\.0\.0\.1/i.test(searchApiUrl)) {
    console.warn(
      '[concierge] EXPO_PUBLIC_SEARCH_API_URL points at localhost. On a physical phone, use your PC’s LAN IP (e.g. http://192.168.1.x:3001). iOS Simulator and Android emulator are OK with localhost (emulator uses 10.0.2.2).'
    )
  }

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
