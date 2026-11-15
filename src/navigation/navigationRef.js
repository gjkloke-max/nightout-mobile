import { createNavigationContainerRef } from '@react-navigation/native'

/**
 * The app's NavigationContainer, for navigating from outside a screen (push notification taps).
 * Screens should keep using their `navigation` prop.
 */
export const navigationRef = createNavigationContainerRef()
