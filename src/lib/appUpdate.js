/**
 * Reads what this build should be told about updating: nothing, "an update is available", or
 * "you must update". The rules are in appUpdateRules.js; this file talks to the device and Supabase.
 *
 * Every failure here ends in "nothing to say". A slow network or a missing table must never stand
 * between someone and the app.
 */
import { Linking, Platform } from 'react-native'
import Constants from 'expo-constants'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from './supabase'
import { decideUpdate, isSnoozed, storeUrlFor } from './appUpdateRules'

/** App Store id (eas.json submit.production.ios.ascAppId). */
const IOS_APP_ID = '6810850381'
const DISMISSED_KEY = 'appUpdate.dismissed'
const CHECK_TIMEOUT_MS = 6000

/** The store build number baked into this build: iOS buildNumber, Android versionCode. */
export function currentBuild() {
  const cfg = Constants.expoConfig || {}
  const raw = Platform.OS === 'ios' ? cfg.ios?.buildNumber : cfg.android?.versionCode
  const n = parseInt(String(raw ?? ''), 10)
  return Number.isInteger(n) && n > 0 ? n : null
}

/** This platform's row of app_release_config, or null when it cannot be read in time. */
async function fetchReleaseConfig() {
  if (!supabase || (Platform.OS !== 'ios' && Platform.OS !== 'android')) return null
  try {
    const query = supabase
      .from('app_release_config')
      .select('min_build, recommended_build, message, store_url')
      .eq('platform', Platform.OS)
      .maybeSingle()
    const timeout = new Promise((resolve) => setTimeout(() => resolve({ data: null, error: new Error('timeout') }), CHECK_TIMEOUT_MS))
    const { data, error } = await Promise.race([query, timeout])
    return error ? null : data || null
  } catch {
    return null
  }
}

async function readDismissed() {
  try {
    const raw = await AsyncStorage.getItem(DISMISSED_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

/**
 * @returns {Promise<{ status: 'required'|'available'|'none', message: string|null, storeUrl: string|null, recommendedBuild: number|null }>}
 */
export async function checkForUpdate() {
  const nothing = { status: 'none', message: null, storeUrl: null, recommendedBuild: null }
  const build = currentBuild()
  if (build == null) return nothing
  const config = await fetchReleaseConfig()
  let status = decideUpdate({ build, config })
  if (status === 'none') return nothing
  const recommendedBuild = parseInt(String(config.recommended_build ?? ''), 10) || null
  if (status === 'available' && isSnoozed({ dismissed: await readDismissed(), recommendedBuild })) status = 'none'
  if (status === 'none') return nothing
  return {
    status,
    message: String(config.message || '').trim() || null,
    storeUrl: storeUrlFor({ platform: Platform.OS, config, iosAppId: IOS_APP_ID, androidPackage: Constants.expoConfig?.android?.package }),
    recommendedBuild,
  }
}

/** Remember that the "update available" prompt for this recommended build was declined. */
export async function dismissUpdate(recommendedBuild) {
  try {
    await AsyncStorage.setItem(DISMISSED_KEY, JSON.stringify({ build: recommendedBuild, at: Date.now() }))
  } catch {
    /* the prompt will simply show again next time */
  }
}

/** Open the store page. Returns false when there is no page to open or the device refuses. */
export async function openStore(storeUrl) {
  if (!storeUrl) return false
  try {
    await Linking.openURL(storeUrl)
    return true
  } catch {
    return false
  }
}
