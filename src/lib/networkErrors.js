/**
 * Telling "the request never got an answer" apart from a real server error, so the app can retry
 * once on its own and show people a plain sentence instead of the native exception text.
 *
 * Since Expo SDK 57 the global fetch is expo/fetch (native URLSession on iOS). When the request
 * fails before any HTTP response arrives it throws FetchError, whose message starts with
 * "fetch failed: " followed by the native description, e.g.
 *   "fetch failed: UnexpectedException: The network connection was lost. (at ExpoModulesCore/…)"
 *   "fetch failed: UnexpectedException: A TLS error caused the secure connection to fail. (…)"
 * The common case on iOS is a pooled keep-alive connection the server already closed: URLSession
 * reuses it for a POST, the socket is dead, and iOS does not retry non-idempotent requests itself.
 * A second attempt opens a fresh connection and goes through.
 *
 * The patterns below also cover React Native's classic fetch and Android (OkHttp) wording.
 */

export const NETWORK_ERROR_MESSAGE = "Couldn't reach Brio. Check your connection and try again."

export const TIMEOUT_ERROR_MESSAGE =
  'Concierge is taking longer than usual. Try again in a moment.'

const TRANSIENT_NETWORK_RE = new RegExp(
  [
    '^fetch failed:',
    'network request failed',
    'network connection was lost',
    'tls error',
    'secure connection',
    'ssl',
    'timed out',
    'timeout',
    'not connected to the internet',
    'appears to be offline',
    'could not connect to the server',
    'hostname could not be found',
    'cannot find host',
    'unable to resolve host',
    'failed to connect',
    'connection reset',
    'connection refused',
    'connection abort',
    'broken pipe',
    'unexpected end of stream',
    'network error',
  ].join('|'),
  'i'
)

/** True when the request failed at the network/TLS level, i.e. there was no HTTP response. */
export function isTransientNetworkError(err) {
  if (!err) return false
  if (err.name === 'AbortError') return false
  const message = String(err.message || err || '')
  return TRANSIENT_NETWORK_RE.test(message)
}

/** A sentence safe to show people for any thrown error; never the native exception text. */
export function friendlyErrorMessage(err, fallback = 'Something went wrong. Try again.') {
  if (isTransientNetworkError(err)) return NETWORK_ERROR_MESSAGE
  const message = String(err?.message || '')
  // Native/stack-looking text is never useful on screen.
  if (!message || /exception|\.swift:|\.java:|\bat [\w.$]+\(/i.test(message)) return fallback
  return message
}
