/**
 * Navigate from notifications.mobile_link JSON (see notificationNavigation.js).
 * @param {import('@react-navigation/native').NavigationProp<any>} navigation
 * @param {string | null | undefined} mobileLink
 * @returns {boolean} true if navigation was dispatched
 */
export function navigateFromNotificationMobileLink(navigation, mobileLink) {
  if (!mobileLink || !navigation) return false
  let parsed
  try {
    parsed = typeof mobileLink === 'string' ? JSON.parse(mobileLink) : mobileLink
  } catch {
    return false
  }
  const route = parsed?.route
  const params = parsed?.params || {}
  if (!route) return false

  switch (route) {
    case 'FriendProfile':
      if (params.userId) {
        navigation.navigate('FriendProfile', { userId: params.userId })
        return true
      }
      break
    case 'VenueProfile':
    case 'Venues':
      if (params.venueId != null) {
        navigation.navigate('VenueProfile', { venueId: params.venueId })
        return true
      }
      break
    case 'SocialReviewDetail':
      if (params.reviewId != null) {
        navigation.navigate('MainTabs', {
          screen: 'Social',
          params: {
            screen: 'SocialReviewDetail',
            params: {
              reviewId: params.reviewId,
              ...(params.commentId != null ? { commentId: params.commentId } : {}),
            },
          },
        })
        return true
      }
      break
    case 'ListDetail':
      if (params.listId != null) {
        navigation.navigate('MainTabs', {
          screen: 'Profile',
          params: {
            screen: 'ListDetail',
            params: {
              listId: params.listId,
              ...(params.commentId != null ? { commentId: params.commentId } : {}),
            },
          },
        })
        return true
      }
      break
    case 'FriendRequests':
      navigation.navigate('MainTabs', {
        screen: 'Profile',
        params: { screen: 'ProfileMain' },
      })
      return true
    case 'Social':
      navigation.navigate('MainTabs', {
        screen: 'Social',
        params: { screen: 'SocialMain' },
      })
      return true
    default:
      return false
  }
  return false
}
