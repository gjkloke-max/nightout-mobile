/**
 * Reading profiles rows without touching other people's private fields.
 *
 * Other users' rows: select PUBLIC_PROFILE_COLUMNS (never '*'). Once
 * the web repo's migrations/profiles_private_fields_phase3.sql runs, these are the only profiles columns a
 * signed-in user can read, and select('*') fails with "permission denied".
 *
 * Your own row, including private fields (home location, onboarding state, ...): call
 * fetchMyProfile(), which goes through the get_my_profile() RPC
 * (web repo migrations/profiles_private_fields_phase2.sql) and only ever returns the caller's row.
 */

/** Keep in sync with the column list in the web repo's migrations/profiles_private_fields_phase3.sql
 * and with web src/services/myProfile.js. */
export const PUBLIC_PROFILE_COLUMNS =
  'id, display_name, first_name, last_name, username, avatar_url, bio, is_private, created_at, updated_at'

/**
 * The signed-in user's own profiles row, or null if they have none.
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} [columns] - narrow the result, e.g. 'home_lat, home_lng'
 * @returns {Promise<{ data: object|null, error: object|null }>}
 */
export async function fetchMyProfile(client, columns = '*') {
  const { data, error } = await client.rpc('get_my_profile').select(columns).maybeSingle()
  return { data: data ?? null, error: error ?? null }
}
