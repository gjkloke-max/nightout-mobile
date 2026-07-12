/**
 * Concierge: Brio Node `POST …/api/concierge` only (OpenAI + ParadeDB on server).
 * Set EXPO_PUBLIC_SEARCH_API_URL to the same base as Browse search (e.g. http://host:3001).
 */

import { Platform } from 'react-native'
import { config } from './config'
import { createSseFullTextFeeder } from './conciergeRequestContext'

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

/** Shared request-body normalization for sendConciergeMessage / streamConciergeMessage. */
function buildNormalizedConciergeBody(requestBody, extra = {}) {
  const raw = requestBody && typeof requestBody === 'object' ? requestBody : {}
  const body = {
    ...raw,
    message: typeof raw.message === 'string' ? raw.message.trim() : '',
    conversationHistory: Array.isArray(raw.conversationHistory)
      ? raw.conversationHistory.map((m) => ({ role: m.role, content: m.content || '' }))
      : [],
    ...extra,
  }
  if (body.userHome && typeof body.userHome === 'object') {
    body.userHome = {
      homeNeighborhoodName: body.userHome.homeNeighborhoodName ?? null,
      lat: body.userHome.lat ?? null,
      lng: body.userHome.lng ?? null,
    }
  }
  return body
}

/** Normalizes a `done` event payload (or non-streaming JSON body) into the shape both API functions return. */
function normalizeConciergeData(data) {
  return {
    response: data.response ?? '',
    reviews: data.reviews ?? [],
    venues: data.venues ?? [],
    searchState: data.searchState ?? null,
    recommendationState: data.recommendationState ?? null,
    canonicalConversationState: data.canonicalConversationState ?? null,
    geoContext: data.geoContext ?? null,
    rankedVenueBacklog: data.rankedVenueBacklog ?? null,
    conciergeDebug: data.conciergeDebug ?? null,
  }
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

  const message = typeof requestBody?.message === 'string' ? requestBody.message.trim() : ''
  if (!message) {
    return { data: null, error: { message: 'message is required' } }
  }

  try {
    const body = buildNormalizedConciergeBody(requestBody, { message })
    const res = await fetchWithTimeout(`${searchApiUrl}/api/concierge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return { data: null, error: { message: data.error || 'Concierge request failed' } }
    }
    return { data: normalizeConciergeData(data), error: null }
  } catch (err) {
    return { data: null, error: conciergeFetchError(err) }
  }
}

/**
 * Streaming variant of sendConciergeMessage. React Native's fetch doesn't reliably support
 * incremental ReadableStream reading across iOS/Android/Expo versions, so this uses
 * XMLHttpRequest + onprogress instead — a well-established pattern for consuming
 * Server-Sent Events in React Native. `onToken` is called with each text delta as it streams
 * in; the returned promise resolves with the same `{ data, error }` shape as
 * sendConciergeMessage once the server's `done` event arrives.
 * @param {Record<string, unknown>} requestBody
 * @param {(deltaText: string) => void} [onToken]
 * @returns {Promise<{ data: object|null, error: { message: string }|null }>}
 */
export function streamConciergeMessage(requestBody, onToken) {
  const searchApiUrl = resolveSearchApiBaseUrl((config.searchApiUrl || '').replace(/\/$/, ''))

  if (!searchApiUrl) {
    return Promise.resolve({
      data: null,
      error: {
        message:
          'Set EXPO_PUBLIC_SEARCH_API_URL to your Brio search API (same host/port as /api/search), e.g. http://192.168.1.5:3001 on a physical device.',
      },
    })
  }

  const message = typeof requestBody?.message === 'string' ? requestBody.message.trim() : ''
  if (!message) {
    return Promise.resolve({ data: null, error: { message: 'message is required' } })
  }

  if (__DEV__) {
    console.log('[concierge] streaming from Brio API', `${searchApiUrl}/api/concierge`)
  }

  const body = buildNormalizedConciergeBody(requestBody, { message, stream: true })

  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest()
    const feeder = createSseFullTextFeeder()
    let settled = false
    let doneData = null

    const settle = (result) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(result)
    }

    const timer = setTimeout(() => {
      xhr.abort()
      settle({ data: null, error: conciergeFetchError({ name: 'AbortError' }) })
    }, config.conciergeTimeoutMs)

    xhr.onprogress = () => {
      if (settled) return
      const events = feeder.feed(xhr.responseText)
      for (const evt of events) {
        if (evt.event === 'token') {
          onToken?.(evt.data?.text || '')
        } else if (evt.event === 'done') {
          doneData = evt.data
        } else if (evt.event === 'error') {
          settle({ data: null, error: { message: evt.data?.error || 'Concierge request failed' } })
        }
      }
    }

    xhr.onload = () => {
      if (settled) return
      if (xhr.status < 200 || xhr.status >= 300) {
        let errorMessage = 'Concierge request failed'
        try {
          errorMessage = JSON.parse(xhr.responseText)?.error || errorMessage
        } catch {
          // response wasn't JSON — keep default message
        }
        settle({ data: null, error: { message: errorMessage } })
        return
      }
      if (!doneData) {
        settle({ data: null, error: { message: 'Concierge stream ended without a response' } })
        return
      }
      settle({ data: normalizeConciergeData(doneData), error: null })
    }

    xhr.onerror = () => {
      settle({ data: null, error: conciergeFetchError(new Error('Network error')) })
    }

    xhr.open('POST', `${searchApiUrl}/api/concierge`)
    xhr.setRequestHeader('Content-Type', 'application/json')
    xhr.send(JSON.stringify(body))
  })
}
