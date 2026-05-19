/**
 * Search API client — calls Node /api/search (BM25 + optional semantic).
 * Uses EXPO_PUBLIC_SEARCH_API_URL. BM25-only when queryEmbedding is null.
 */

import { config } from './config'

export async function hybridSearch({
  queryText,
  queryEmbedding = null,
  matchCount = 20,
  excludeVenueIds,
  userPreferences,
  forYouBrowse = false,
  effectiveNeighborhood,
}) {
  const baseUrl = (config.searchApiUrl || '').replace(/\/$/, '')
  if (!baseUrl) {
    return { data: [], error: new Error('Search API URL not configured') }
  }

  const url = `${baseUrl}/api/search`
  const body = {
    query_text: queryText || '',
    query_embedding_array: queryEmbedding || [],
    match_count: matchCount,
  }
  if (Array.isArray(excludeVenueIds) && excludeVenueIds.length > 0) {
    body.exclude_venue_ids = excludeVenueIds
  }
  if (forYouBrowse) {
    body.for_you_browse = true
    if (
      userPreferences &&
      typeof userPreferences === 'object' &&
      (userPreferences.foodStyles?.length ||
        userPreferences.ambience?.length ||
        userPreferences.allergies?.length ||
        userPreferences.dislikes?.length)
    ) {
      body.user_preferences = userPreferences
    }
  }
  if (effectiveNeighborhood && typeof effectiveNeighborhood === 'string' && effectiveNeighborhood.trim()) {
    body.effective_neighborhood = effectiveNeighborhood.trim()
  }

  if (__DEV__) {
    console.log('[SearchAPI] POST', url)
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Brio-Mobile/1.0',
      },
      body: JSON.stringify(body),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      return { data: [], error: new Error(json.error || 'Search failed') }
    }
    return {
      data: json.reviews || [],
      error: null,
      neighborhood: json.neighborhood ?? null,
    }
  } catch (err) {
    if (__DEV__) {
      console.warn('[SearchAPI] fetch failed:', err?.message, err)
    }
    return { data: [], error: err }
  }
}

/** BM25-only search (no embedding). */
export async function bm25Search({ queryText, matchCount = 20 }) {
  return hybridSearch({ queryText, queryEmbedding: null, matchCount })
}
