/**
 * Launch context for CreateListScreen.
 * Profile tab: after save go to ListDetail; close/back → Profile.
 * Venue profile: after save / close / back → Venue Profile.
 */
export const LIST_BUILDER_ORIGIN_PROFILE = 'profile'

/** Venue Profile → Add to List → Create New List */
export const LIST_BUILDER_ORIGIN_VENUE_PROFILE_ADD_TO_LIST = 'venue_profile_add_to_list'

/** @deprecated prefer LIST_BUILDER_ORIGIN_VENUE_PROFILE_ADD_TO_LIST */
export const LIST_BUILDER_ORIGIN_VENUE_PROFILE = 'venue_profile'

export function isVenueProfileListBuilderOrigin(origin) {
  return (
    origin === LIST_BUILDER_ORIGIN_VENUE_PROFILE_ADD_TO_LIST ||
    origin === LIST_BUILDER_ORIGIN_VENUE_PROFILE
  )
}
