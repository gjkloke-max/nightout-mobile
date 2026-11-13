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

/**
 * Save fields on the signed-in user's own profiles row, creating the row if it doesn't exist.
 *
 * Use this instead of .upsert() whenever the fields include anything outside
 * PUBLIC_PROFILE_COLUMNS (email, home_address, onboarding_*, ...). An upsert is
 * INSERT ... ON CONFLICT DO UPDATE SET col = EXCLUDED.col, and Postgres requires SELECT
 * permission on every column it sets that way — which signed-in users won't have on private
 * columns once phase 3 runs. A plain UPDATE (then INSERT if no row) needs only `id`.
 *
 * Errors come back unchanged, so callers can still check code '23505' (username taken).
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} userId - the signed-in user's id
 * @param {object} fields - columns to set (id is ignored)
 * @returns {Promise<{ error: object|null }>}
 */
export async function saveMyProfile(client, userId, fields) {
  const { id: _ignored, ...values } = fields || {}
  const { error, count } = await client.from('profiles').update(values, { count: 'exact' }).eq('id', userId)
  if (error) return { error }
  if (count > 0) return { error: null }

  const { error: insertError } = await client.from('profiles').insert({ ...values, id: userId })
  if (insertError?.code === '23505') {
    // Either the row appeared meanwhile, or the username is taken: retrying the update
    // succeeds in the first case and returns the username conflict in the second.
    const { error: retryError } = await client.from('profiles').update(values).eq('id', userId)
    return { error: retryError ?? null }
  }
  return { error: insertError ?? null }
}
