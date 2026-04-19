/**
 * App config — reads from env vars or expo-constants extra.
 * Use same values as web app (EXPO_PUBLIC_* in .env).
 */

import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra || {};

/** Edge concierge: embed + parallel search + insights + venue + chat — often 60–120s+; default 5 minutes before client abort. */
const conciergeTimeoutMs = (() => {
  const raw = process.env.EXPO_PUBLIC_CONCIERGE_TIMEOUT_MS || extra.conciergeTimeoutMs;
  const n = raw != null && raw !== '' ? parseInt(String(raw), 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 300000;
})();

const webAppUrl =
  process.env.EXPO_PUBLIC_WEB_APP_URL ||
  extra.webAppUrl ||
  ''

const appScheme =
  process.env.EXPO_PUBLIC_APP_SCHEME ||
  extra.appScheme ||
  'nightout'

const googleMapsApiKey =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || extra.googleMapsApiKey || ''

export const config = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || extra.supabaseUrl || '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || extra.supabaseAnonKey || '',
  /** Google Maps / Places (address autocomplete + details). */
  googleMapsApiKey,
  // Search API: for local dev use your machine IP (e.g. 192.168.1.x:3001) or staging URL
  searchApiUrl: process.env.EXPO_PUBLIC_SEARCH_API_URL || extra.searchApiUrl || '',
  conciergeTimeoutMs,
  /** Canonical web origin for venue share links, e.g. https://app.nightout.com (no trailing slash). */
  webAppUrl,
  /** URL scheme for deep links, e.g. nightout → nightout://venue/:id */
  appScheme,
};

if (__DEV__ && config.searchApiUrl) {
  console.log('[Config] Search API URL:', config.searchApiUrl);
}
