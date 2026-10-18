import { Platform } from 'react-native'
import Constants from 'expo-constants'
import * as WebBrowser from 'expo-web-browser'
import * as Linking from 'expo-linking'
import * as AppleAuthentication from 'expo-apple-authentication'
import { supabase } from '../lib/supabase'

const extra = Constants.expoConfig?.extra || {}
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || extra.googleIosClientId || ''
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || extra.googleWebClientId || ''

/**
 * The native Google SDK, when this build has it. Native sign-in shows Google's own account sheet;
 * the browser flow below makes iOS ask "Brio wants to use <supabase project>.supabase.co to Sign In".
 *
 * Not available in Expo Go (no native module), on Android (needs its own Play signing setup), or in
 * a build made without the client IDs — those keep the browser flow. Required lazily so a build
 * without the module never crashes at import.
 */
let googleNative
function nativeGoogle() {
  if (googleNative !== undefined) return googleNative
  googleNative = null
  if (Platform.OS !== 'ios' || Constants.executionEnvironment === 'storeClient') return null
  if (!GOOGLE_IOS_CLIENT_ID || !GOOGLE_WEB_CLIENT_ID) return null
  try {
    const mod = require('@react-native-google-signin/google-signin')
    // The ID token is issued for the web client, which is the client Supabase's Google provider
    // is configured with, so Supabase accepts it.
    mod.GoogleSignin.configure({ iosClientId: GOOGLE_IOS_CLIENT_ID, webClientId: GOOGLE_WEB_CLIENT_ID })
    googleNative = mod
  } catch {
    googleNative = null
  }
  return googleNative
}

/** Sign out of the native Google session too, so the next sign-in offers the account choice. */
export async function signOutGoogleNative() {
  const mod = nativeGoogle()
  if (!mod) return
  try {
    await mod.GoogleSignin.signOut()
  } catch {
    // best effort
  }
}

export function getOAuthRedirectUrl() {
  return Linking.createURL('auth/callback')
}

/**
 * Dev-only: prints the exact URL to paste in Supabase → Authentication → URL Configuration → Redirect URLs.
 * Look in the Metro / Expo terminal (not only the device).
 */
export function logDevOAuthRedirectUrl() {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return
  const url = getOAuthRedirectUrl()
  console.log(
    '\n━━ Supabase: add this Redirect URL (exact copy) ━━\n' +
      url +
      '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'
  )
}

function parseTokensFromUrl(url) {
  try {
    const parsed = new URL(url)
    const hash = (parsed.hash || '').replace(/^#/, '')
    if (hash) {
      const sp = new URLSearchParams(hash)
      const access_token = sp.get('access_token')
      const refresh_token = sp.get('refresh_token')
      if (access_token && refresh_token) return { access_token, refresh_token }
    }
    const code = parsed.searchParams.get('code')
    if (code) return { code }
  } catch {
    // ignore
  }
  return null
}

/**
 * @returns {Promise<{ error?: string }>}
 */
export async function signInWithGoogle() {
  if (!supabase) return { error: 'Supabase not configured' }
  const native = nativeGoogle()
  return native ? signInWithGoogleNative(native) : signInWithGoogleBrowser()
}

/** Google's native account sheet, then the ID token goes to Supabase — the same path as Apple. */
async function signInWithGoogleNative({ GoogleSignin, statusCodes }) {
  let response
  try {
    response = await GoogleSignin.signIn()
  } catch (e) {
    if (e?.code === statusCodes?.SIGN_IN_CANCELLED) return { error: 'cancelled' }
    if (e?.code === statusCodes?.IN_PROGRESS) return { error: 'cancelled' }
    return { error: e?.message || 'Google sign-in failed' }
  }
  if (response?.type === 'cancelled') return { error: 'cancelled' }
  const idToken = response?.data?.idToken
  if (!idToken) return { error: 'No identity token from Google' }

  const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: idToken })
  if (error) return { error: error.message }
  return {}
}

async function signInWithGoogleBrowser() {
  const redirectTo = getOAuthRedirectUrl()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  })
  if (error) return { error: error.message }
  if (!data?.url) return { error: 'No OAuth URL' }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo)
  if (result.type !== 'success' || !result.url) {
    return { error: result.type === 'cancel' ? 'cancelled' : 'Google sign-in failed' }
  }

  const tokens = parseTokensFromUrl(result.url)
  if (tokens?.access_token && tokens?.refresh_token) {
    const { error: sessErr } = await supabase.auth.setSession({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
    })
    if (sessErr) return { error: sessErr.message }
    return {}
  }

  if (tokens?.code) {
    const { error: exErr } = await supabase.auth.exchangeCodeForSession(tokens.code)
    if (exErr) return { error: exErr.message }
    return {}
  }

  return { error: 'Could not complete Google sign-in' }
}

/**
 * @returns {Promise<{ error?: string, fullName?: { firstName?: string, lastName?: string } }>}
 */
export async function signInWithApple() {
  if (!supabase) return { error: 'Supabase not configured' }
  const available = await AppleAuthentication.isAvailableAsync()
  if (!available) return { error: 'Apple Sign In is not available on this device' }

  let credential
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    })
  } catch (e) {
    if (e?.code === 'ERR_REQUEST_CANCELED') return { error: 'cancelled' }
    return { error: e?.message || 'Apple sign-in failed' }
  }

  if (!credential.identityToken) return { error: 'No identity token from Apple' }

  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
  })
  if (error) return { error: error.message }

  let firstName
  let lastName
  if (credential.fullName) {
    firstName = credential.fullName.givenName || undefined
    lastName = credential.fullName.familyName || undefined
  }
  return { fullName: { firstName, lastName } }
}
