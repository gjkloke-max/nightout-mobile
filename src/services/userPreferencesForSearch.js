/**
 * Load and shape user preferences for hybrid search (Browse For You).
 * Mirrors web `src/services/userPreferencesForSearch.js`.
 */

import { supabase } from '../lib/supabase'

export function hasActiveUserPreferences(prefs) {
  if (!prefs || typeof prefs !== 'object') return false
  return Boolean(
    prefs.foodStyles?.length ||
      prefs.ambience?.length ||
      prefs.allergies?.length ||
      prefs.dislikes?.length
  )
}

export function organizePreferencesFromMasters(prefMasters) {
  const prefsByType = {
    foodStyles: [],
    ambience: [],
    allergies: [],
    dislikes: [],
  }

  for (const pref of prefMasters || []) {
    if (!pref) continue

    const prefName = pref.preference_name || ''
    const category = Array.isArray(pref.preference_category)
      ? pref.preference_category[0]
      : pref.preference_category
    const categorySlug = (category?.slug || '').toLowerCase()

    if (categorySlug === 'food' || categorySlug === 'drink') {
      prefsByType.foodStyles.push(prefName)
    } else if (categorySlug === 'dietary' || pref.is_hard_constraint) {
      prefsByType.allergies.push(prefName)
    } else if (categorySlug === 'vibe' || categorySlug === 'occasion') {
      prefsByType.ambience.push(prefName)
    } else {
      const prefType = Array.isArray(pref.preference_type) ? pref.preference_type[0] : pref.preference_type
      const typeName = (prefType?.preference_type_name || '').toLowerCase()
      if (typeName.includes('food') || typeName.includes('cuisine') || typeName.includes('style')) {
        prefsByType.foodStyles.push(prefName)
      } else if (typeName.includes('ambience') || typeName.includes('atmosphere') || typeName.includes('vibe')) {
        prefsByType.ambience.push(prefName)
      } else if (typeName.includes('allerg') || typeName.includes('dietary') || typeName.includes('restriction')) {
        prefsByType.allergies.push(prefName)
      } else if (typeName.includes('dislike') || typeName.includes('avoid')) {
        prefsByType.dislikes.push(prefName)
      } else {
        const foodKeywords = ['italian', 'mexican', 'asian', 'pizza', 'sushi', 'vegan', 'vegetarian', 'gluten']
        if (foodKeywords.some((keyword) => prefName.toLowerCase().includes(keyword))) {
          prefsByType.foodStyles.push(prefName)
        } else {
          prefsByType.ambience.push(prefName)
        }
      }
    }
  }

  return prefsByType
}

export async function loadUserPreferencesForSearch(userId) {
  if (!userId || !supabase) return null

  const { data: userPrefIds, error: idsError } = await supabase
    .from('user_preference')
    .select('preference_master_id')
    .eq('user_id', userId)

  if (idsError) {
    console.error('[userPreferencesForSearch] user_preference', idsError)
    return null
  }

  if (!userPrefIds?.length) return null

  const prefMasterIds = userPrefIds.map((up) => up.preference_master_id)
  const { data: prefMasters, error: mastersError } = await supabase
    .from('preference_master')
    .select(`
      preference_master_id,
      preference_name,
      is_hard_constraint,
      preference_type (preference_type_id, preference_type_name),
      preference_category:preference_category_id (preference_category_id, slug)
    `)
    .in('preference_master_id', prefMasterIds)

  if (mastersError) {
    console.error('[userPreferencesForSearch] preference_master', mastersError)
    return null
  }

  if (!prefMasters?.length) return null

  const organized = organizePreferencesFromMasters(prefMasters)
  return hasActiveUserPreferences(organized) ? organized : null
}
