import * as WebBrowser from 'expo-web-browser'
import * as Linking from 'expo-linking'
import * as AppleAuthentication from 'expo-apple-authentication'
import { supabase } from '../lib/supabase'

export function getOAuthRedirectUrl() {
  return Linking.createURL('auth/callback')
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
