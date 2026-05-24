/**
 * Concierge: Brio Node `POST …/api/concierge` only (OpenAI + ParadeDB on server).
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

/**
 * POST /api/concierge — accepts the same body as web `buildConciergeRequest().body`.
 * @param {Record<string, unknown>} requestBody
 */
export async function sendConciergeMessage(requestBody) {
  const searchApiUrl = resolveSearchApiBaseUrl((config.searchApiUrl || '').replace(/\/$/, ''))

  if (!searchApiUrl) {
    return {
      data: null,
      error: {
        message:
          'Set EXPO_PUBLIC_SEARCH_API_URL to your Brio search API (same host/port as /api/search), e.g. http://192.168.1.5:3001 on a physical device.',
      },
    }
  }

  if (__DEV__ && /localhost|127\.0\.0\.1/i.test(searchApiUrl)) {
    console.warn(
      '[concierge] EXPO_PUBLIC_SEARCH_API_URL points at localhost. On a physical phone, use your PC’s LAN IP (e.g. http://192.168.1.x:3001). iOS Simulator and Android emulator are OK with localhost (emulator uses 10.0.2.2).'
    )
  }

  if (__DEV__) {
    console.log('[concierge] using Brio API', `${searchApiUrl}/api/concierge`)
  }

  const raw = requestBody && typeof requestBody === 'object' ? requestBody : {}
  const message = typeof raw.message === 'string' ? raw.message.trim() : ''
  if (!message) {
    return { data: null, error: { message: 'message is required' } }
  }

  try {
    const body = {
      ...raw,
      message,
      conversationHistory: Array.isArray(raw.conversationHistory)
        ? raw.conversationHistory.map((m) => ({ role: m.role, content: m.content || '' }))
        : [],
    }
    if (body.userHome && typeof body.userHome === 'object') {
      body.userHome = {
        homeNeighborhoodName: body.userHome.homeNeighborhoodName ?? null,
        lat: body.userHome.lat ?? null,
        lng: body.userHome.lng ?? null,
      }
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
        searchState: data.searchState ?? null,
        recommendationState: data.recommendationState ?? null,
        canonicalConversationState: data.canonicalConversationState ?? null,
        geoContext: data.geoContext ?? null,
        rankedVenueBacklog: data.rankedVenueBacklog ?? null,
        conciergeDebug: data.conciergeDebug ?? null,
      },
      error: null,
    }
  } catch (err) {
    return { data: null, error: conciergeFetchError(err) }
  }
}
