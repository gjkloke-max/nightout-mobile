/**
 * Mobile push notifications: permission, Expo push token, Android channel.
 *
 * Sending happens on the server: an AFTER INSERT trigger on public.notifications calls the send-push
 * Edge Function (web repo: migrations/notification_mobile_push.sql, supabase/functions/send-push).
 * This file only gets this phone a token and saves it with register_push_token().
 *
 * When to ask: never on first launch. iOS shows its permission prompt exactly once per install, so
 * the app asks (a) with a short in-app question after the user's first follow, and only shows the
 * system prompt if they say yes, or (b) from the banner on Notification Settings.
 */

import { Alert, Linking, Platform } from 'react-native'
import * as Notifications from 'expo-notifications'
import Constants from 'expo-constants'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '../lib/supabase'

/** Must match `defaultChannel` in app.config.js and ANDROID_CHANNEL_ID in send-push. */
export const ANDROID_CHANNEL_ID = 'default'

const SOFT_ASK_SHOWN_KEY = 'brio.push.softAskShown'
/** The token this phone last registered, so sign-out can remove it without asking Expo again. */
const REGISTERED_TOKEN_KEY = 'brio.push.registeredToken'

const supported = Platform.OS === 'ios' || Platform.OS === 'android'

if (supported) {
  // While the app is open, still show the banner (otherwise iOS drops foreground pushes silently).
  // Sound on Android only: Android files a silent notification straight into the shade with no
  // pop-up, even on a high-importance channel. iOS shows the banner either way.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: Platform.OS === 'android',
      shouldSetBadge: false,
    }),
  })
}

/**
 * @returns {Promise<'granted' | 'denied' | 'undetermined' | 'unsupported'>}
 *   'denied' means the system prompt can no longer be shown; only the phone's Settings app can
 *   turn notifications on.
 */
export async function getPushPermissionState() {
  if (!supported) return 'unsupported'
  try {
    const p = await Notifications.getPermissionsAsync()
    if (p.granted || p.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) return 'granted'
    if (p.status === 'undetermined' || p.canAskAgain) return 'undetermined'
    return 'denied'
  } catch {
    return 'undetermined'
  }
}

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'Notifications',
    description: 'Follows, likes, comments and replies',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 200, 120, 200],
    lightColor: '#9D174D',
  })
}

/** Shows the system prompt (if it still can) and registers the token when allowed. */
export async function requestPushPermission() {
  if (!supported) return 'unsupported'
  try {
    // Android 13+: the channel must exist before asking.
    await ensureAndroidChannel()
    await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    })
  } catch (e) {
    console.warn('[push] permission request failed:', e?.message || e)
  }
  const state = await getPushPermissionState()
  if (state === 'granted') await registerPushToken({ force: true })
  return state
}

/** Re-save an unchanged token at most this often (app start / foreground call registerPushToken). */
const REREGISTER_MS = 6 * 60 * 60 * 1000

let inFlight = null
/** @type {{ userId: string, token: string, at: number } | null} */
let lastSuccess = null
/** Why the last attempt failed, for the Notification Settings screen. Null after a success. */
let lastError = null

export function getLastPushError() {
  return lastError
}

/**
 * Get this phone's Expo push token and save it for the signed-in user. Does nothing without
 * permission. Never throws.
 *
 * Cheap to call often (app start, every return to the foreground): only one attempt runs at a time,
 * and an account whose token was saved in the last REREGISTER_MS is skipped without touching the
 * network. `force` skips that check (right after permission is granted).
 *
 * Do NOT call this from Notifications.addPushTokenListener: fetching the token fires that listener,
 * so it loops (build iOS 16 / Android 3 did this ~50 times a second).
 */
export function registerPushToken({ force = false } = {}) {
  if (!supported || !supabase) return Promise.resolve(null)
  if (!inFlight) {
    inFlight = doRegisterPushToken(force).finally(() => {
      inFlight = null
    })
  }
  return inFlight
}

async function doRegisterPushToken(force) {
  let step = 'permission'
  try {
    if ((await getPushPermissionState()) !== 'granted') return null

    step = 'session'
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const userId = session?.user?.id
    if (!userId) return null
    if (
      !force &&
      lastSuccess &&
      lastSuccess.userId === userId &&
      Date.now() - lastSuccess.at < REREGISTER_MS
    ) {
      return lastSuccess.token
    }

    step = 'channel'
    await ensureAndroidChannel()

    step = 'token'
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId })
    if (!token) throw new Error('no token returned')

    step = 'save'
    const version = Constants.expoConfig?.version || ''
    const build =
      Platform.OS === 'ios'
        ? Constants.expoConfig?.ios?.buildNumber
        : Constants.expoConfig?.android?.versionCode
    const { error } = await supabase.rpc('register_push_token', {
      p_token: token,
      p_platform: Platform.OS,
      p_app_version: build ? `${version} (${build})` : version,
    })
    if (error) throw new Error(error.message)

    await AsyncStorage.setItem(REGISTERED_TOKEN_KEY, token).catch(() => {})
    lastSuccess = { userId, token, at: Date.now() }
    lastError = null
    return token
  } catch (e) {
    // Simulators, Android builds without google-services.json, no network: push just stays off.
    lastError = `${step}: ${e?.message || e}`
    console.warn('[push] token registration failed at', lastError)
    return null
  }
}

/**
 * Remove this phone's token from the signed-in account. Call before signing out (it needs the session
 * for RLS). Gives up after `timeoutMs` so signing out offline never hangs. Never throws.
 */
export async function unregisterPushToken(timeoutMs = 3000) {
  if (!supported || !supabase) return
  let token = null
  try {
    token = await AsyncStorage.getItem(REGISTERED_TOKEN_KEY)
  } catch {}
  if (!token) return
  const remove = supabase
    .from('notification_push_targets')
    .delete()
    .eq('channel', 'expo_push')
    .eq('token', token)
    .then(({ error }) => {
      if (error) console.warn('[push] could not remove token:', error.message)
    })
  await Promise.race([remove, new Promise((r) => setTimeout(r, timeoutMs))]).catch(() => {})
  // If the delete never arrived, the next account to sign in here takes the token over
  // (register_push_token removes it from other users), so nothing leaks for long.
  await AsyncStorage.removeItem(REGISTERED_TOKEN_KEY).catch(() => {})
  lastSuccess = null
}

/**
 * After the user's first follow: one short in-app question, then the system prompt only if they say
 * yes. Asked at most once per install; afterwards the Notification Settings banner is the way in.
 */
export async function maybeAskForPushAfterFollow() {
  if (!supported) return
  const state = await getPushPermissionState()
  if (state === 'granted') {
    registerPushToken()
    return
  }
  if (state !== 'undetermined') return
  try {
    if (await AsyncStorage.getItem(SOFT_ASK_SHOWN_KEY)) return
    await AsyncStorage.setItem(SOFT_ASK_SHOWN_KEY, '1')
  } catch {
    return
  }
  Alert.alert(
    'Turn on notifications?',
    'Get a notification when someone follows you, likes your posts or replies to you. You can choose which ones in Settings.',
    [
      { text: 'Not now', style: 'cancel' },
      { text: 'Turn on', onPress: () => requestPushPermission() },
    ],
  )
}

/** For the 'denied' case: only the phone's Settings app can turn notifications back on. */
export function openPhoneNotificationSettings() {
  Linking.openSettings().catch(() => {})
}
