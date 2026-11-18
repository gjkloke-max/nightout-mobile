/**
 * Concierge: Brio Node `POST …/api/concierge` only (OpenAI + ParadeDB on server).
 * Set EXPO_PUBLIC_SEARCH_API_URL to the same base as Browse search (e.g. http://host:3001).
 */

import { Platform } from 'react-native'
import { config } from './config'
import { supabase } from './supabase'
import {
  NETWORK_ERROR_MESSAGE,
  TIMEOUT_ERROR_MESSAGE,
  friendlyErrorMessage,
  isTransientNetworkError,
} from './networkErrors'

/** Android emulator maps host “localhost” to the dev machine via 10.0.2.2 */
function resolveSearchApiBaseUrl(url) {
  const trimmed = (url || '').replace(/\/$/, '')
  if (!trimmed || !__DEV__ || Platform.OS !== 'android') return trimmed
  return trimmed.replace(
    /^(https?:\/\/)(127\.0\.0\.1|localhost)(:\d+)?$/i,
    (_, proto, _host, port) => `${proto}10.0.2.2${port ?? ''}`
  )
}

class ConciergeTimeoutError extends Error {
  constructor() {
    super('Concierge request timed out')
    this.name = 'ConciergeTimeoutError'
  }
}

async function fetchWithTimeout(url, options = {}, timeoutMs) {
  const ms = timeoutMs ?? config.conciergeTimeoutMs
  const controller = new AbortController()
  // expo/fetch reports a cancelled request as a generic FetchError, not an AbortError, so the
  // timeout is tracked here rather than inferred from the error it throws.
  let timedOut = false
  const id = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, ms)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } catch (err) {
    if (timedOut) throw new ConciergeTimeoutError()
    throw err
  } finally {
    clearTimeout(id)
  }
}

/** Wait before the one automatic retry, so a connection that just dropped has a moment to recover. */
const RETRY_DELAY_MS = 600
/** No automatic retry after this long: the user has already waited, and gets a Try again button. */
const RETRY_WITHIN_MS = 20000

/**
 * POST with one automatic retry when the request fails at the network/TLS level (no HTTP
 * response) — see networkErrors.js for why that is safe and why it is needed on iOS.
 */
async function postWithRetry(url, options) {
  const started = Date.now()
  try {
    return await fetchWithTimeout(url, options)
  } catch (err) {
    // Never after our own timeout: the user has already waited the full limit.
    if (err instanceof ConciergeTimeoutError) throw err
    if (!isTransientNetworkError(err) || Date.now() - started > RETRY_WITHIN_MS) throw err
    if (__DEV__) console.warn('[concierge] network error, retrying once:', err?.message)
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
    return await fetchWithTimeout(url, options)
  }
}

function conciergeFetchError(err) {
  if (err instanceof ConciergeTimeoutError || err?.name === 'AbortError') {
    return { message: TIMEOUT_ERROR_MESSAGE, retryable: true }
  }
  if (isTransientNetworkError(err)) {
    return { message: NETWORK_ERROR_MESSAGE, retryable: true }
  }
  if (__DEV__) console.warn('[concierge] request failed:', err?.message)
  return { message: friendlyErrorMessage(err), retryable: true }
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

    // Signed-in users send their token so the concierge can apply their saved preferences — the
    // web client always did; without it every mobile user was treated as signed out. A missing or
    // expired session just means no preferences, never a failed request.
    const headers = { 'Content-Type': 'application/json' }
    try {
      const token = supabase ? (await supabase.auth.getSession())?.data?.session?.access_token : null
      if (token) headers.Authorization = `Bearer ${token}`
    } catch {
      // no session: send the request without preferences
    }

    const res = await postWithRetry(`${searchApiUrl}/api/concierge`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })
    let bodyFailed = false
    const data = await res.json().catch(() => {
      bodyFailed = true
      return {}
    })
    // A 200 whose body never arrived intact (connection dropped mid-download) is a network
    // failure, not an empty answer.
    if (res.ok && bodyFailed) {
      return { data: null, error: { message: NETWORK_ERROR_MESSAGE, retryable: true } }
    }
    if (!res.ok) {
      // 5xx (including nginx 502/504 while the API restarts) is worth retrying; 4xx is not.
      const retryable = res.status >= 500
      const message =
        retryable || !data.error
          ? "Concierge couldn't answer just now. Try again in a moment."
          : data.error
      return { data: null, error: { message, retryable } }
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
