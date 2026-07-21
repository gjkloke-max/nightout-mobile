import { createClient } from '@supabase/supabase-js'
import * as SecureStore from 'expo-secure-store'
import * as Crypto from 'expo-crypto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as aesjs from 'aes-js'
import { config } from './config'

const supabaseUrl = config.supabaseUrl
const supabaseAnonKey = config.supabaseAnonKey

/**
 * expo-secure-store (iOS Keychain) has a hard ~2048 byte limit per value. Supabase's session
 * payload - especially for OAuth users, whose user_metadata carries extra fields like avatar_url
 * and full_name from the provider - routinely exceeds that, causing SecureStore writes to silently
 * fail or hang. Store only a random per-key AES key in SecureStore (small, fixed size) and put the
 * actual encrypted session blob in AsyncStorage, which has no size cap. Matches Supabase's own
 * documented pattern for Expo apps with SecureStore-sized sessions.
 */
const LargeSecureStoreAdapter = {
  getItem: async (key) => {
    const t0 = Date.now()
    const tlog = (msg) => console.log(`[DEBUG_ONBOARDING] +${Date.now() - t0}ms LargeSecureStoreAdapter.getItem(${key}): ${msg}`)
    try {
      tlog('calling AsyncStorage.getItem')
      const encrypted = await AsyncStorage.getItem(key)
      tlog(`AsyncStorage.getItem returned, hasValue=${!!encrypted}`)
      if (!encrypted) return null
      tlog('calling SecureStore.getItemAsync')
      const encryptionKeyHex = await SecureStore.getItemAsync(key)
      tlog(`SecureStore.getItemAsync returned, hasKey=${!!encryptionKeyHex}`)
      if (!encryptionKeyHex) return null
      const cipher = new aesjs.ModeOfOperation.ctr(aesjs.utils.hex.toBytes(encryptionKeyHex), new aesjs.Counter(1))
      const decryptedBytes = cipher.decrypt(aesjs.utils.hex.toBytes(encrypted))
      tlog('decrypted successfully')
      return aesjs.utils.utf8.fromBytes(decryptedBytes)
    } catch (e) {
      tlog(`threw: ${e?.message}`)
      return null
    }
  },
  setItem: async (key, value) => {
    const t0 = Date.now()
    const tlog = (msg) => console.log(`[DEBUG_ONBOARDING] +${Date.now() - t0}ms LargeSecureStoreAdapter.setItem(${key}): ${msg}`)
    try {
      tlog(`start, value length=${value?.length}`)
      const encryptionKeyBytes = await Crypto.getRandomBytesAsync(32)
      tlog('got random bytes')
      const cipher = new aesjs.ModeOfOperation.ctr(encryptionKeyBytes, new aesjs.Counter(1))
      const encryptedBytes = cipher.encrypt(aesjs.utils.utf8.toBytes(value))
      tlog('encrypted')
      await SecureStore.setItemAsync(key, aesjs.utils.hex.fromBytes(encryptionKeyBytes))
      tlog('SecureStore.setItemAsync done')
      await AsyncStorage.setItem(key, aesjs.utils.hex.fromBytes(encryptedBytes))
      tlog('AsyncStorage.setItem done')
    } catch (e) {
      tlog(`threw: ${e?.message}`)
    }
  },
  removeItem: async (key) => {
    try {
      await AsyncStorage.removeItem(key)
      await SecureStore.deleteItemAsync(key)
    } catch {}
  },
}

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Missing Supabase env. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env'
  )
}

/** Wraps the global fetch so we can see whether Supabase's own network requests are actually
 * dispatched and whether/when a response (or network error) comes back - the fastest way to tell
 * a stuck-in-JS hang apart from a stuck-at-the-network-layer hang. */
async function loggingFetch(input, init) {
  const url = typeof input === 'string' ? input : input?.url
  const t0 = Date.now()
  console.log(`[DEBUG_ONBOARDING] fetch: dispatching ${init?.method || 'GET'} ${url}`)
  try {
    const res = await fetch(input, init)
    console.log(`[DEBUG_ONBOARDING] +${Date.now() - t0}ms fetch: response ${res.status} for ${url}`)
    return res
  } catch (e) {
    console.log(`[DEBUG_ONBOARDING] +${Date.now() - t0}ms fetch: THREW ${e?.message} for ${url}`)
    throw e
  }
}

console.log(
  '[DEBUG_ONBOARDING] lock env check: typeof window=', typeof window,
  'typeof document=', typeof document,
  'navigator.locks=', typeof globalThis?.navigator?.locks,
)

/**
 * Supabase's GoTrueClient serializes any operation that touches the session (setSession,
 * getSession, token refresh, etc.) through a single named lock, so a query needing the current
 * access token (like our profiles select) can't proceed until whatever's holding the lock releases
 * it. Reimplements the same single-flight queue as their own processLock, but with logging on every
 * acquire/release so a stuck/orphaned lock is directly visible instead of inferred.
 */
const LOCK_QUEUES = {}
async function loggingLock(name, acquireTimeout, fn) {
  const t0 = Date.now()
  const tlog = (msg) => console.log(`[DEBUG_ONBOARDING] +${Date.now() - t0}ms loggingLock(${name}): ${msg}`)
  const previous = LOCK_QUEUES[name] ?? Promise.resolve()
  tlog(`requested, waiting on previous holder (already settled=${previous === Promise.resolve()})`)
  const current = (async () => {
    try {
      await previous
    } catch {
      // previous holder's error doesn't block us
    }
    tlog('acquired')
    try {
      return await fn()
    } finally {
      tlog('released')
    }
  })()
  LOCK_QUEUES[name] = current.catch(() => {})
  return current
}

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: LargeSecureStoreAdapter,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        lock: loggingLock,
      },
      global: {
        fetch: loggingFetch,
      },
    })
  : null
