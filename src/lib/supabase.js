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
    try {
      const encrypted = await AsyncStorage.getItem(key)
      if (!encrypted) return null
      const encryptionKeyHex = await SecureStore.getItemAsync(key)
      if (!encryptionKeyHex) return null
      const cipher = new aesjs.ModeOfOperation.ctr(aesjs.utils.hex.toBytes(encryptionKeyHex), new aesjs.Counter(1))
      const decryptedBytes = cipher.decrypt(aesjs.utils.hex.toBytes(encrypted))
      return aesjs.utils.utf8.fromBytes(decryptedBytes)
    } catch {
      return null
    }
  },
  setItem: async (key, value) => {
    try {
      const encryptionKeyBytes = await Crypto.getRandomBytesAsync(32)
      const cipher = new aesjs.ModeOfOperation.ctr(encryptionKeyBytes, new aesjs.Counter(1))
      const encryptedBytes = cipher.encrypt(aesjs.utils.utf8.toBytes(value))
      await SecureStore.setItemAsync(key, aesjs.utils.hex.fromBytes(encryptionKeyBytes))
      await AsyncStorage.setItem(key, aesjs.utils.hex.fromBytes(encryptedBytes))
    } catch {}
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

/**
 * React Native has no Navigator LockManager, so supabase-js defaults to a true no-op lock -
 * concurrent session operations (e.g. an auto token refresh racing a manual sign-in) aren't
 * serialized at all. This is the same single-flight queue supabase-js itself ships as
 * `processLock` for non-browser environments, reimplemented locally rather than importing an
 * undeclared transitive dependency.
 */
const LOCK_QUEUES = {}
async function singleFlightLock(name, _acquireTimeout, fn) {
  const previous = LOCK_QUEUES[name] ?? Promise.resolve()
  const current = (async () => {
    try {
      await previous
    } catch {
      // previous holder's error doesn't block us
    }
    return await fn()
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
        lock: singleFlightLock,
      },
    })
  : null
