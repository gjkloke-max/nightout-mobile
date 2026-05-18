import { Platform } from 'react-native'
import { authColors } from './authTheme'

/**
 * Thin header bar with native back only; chrome matches auth/onboarding canvas (not Profile gray).
 */
export const onboardingStackScreenOptions = {
  headerShown: true,
  headerStyle: { backgroundColor: authColors.canvas },
  headerTintColor: authColors.textPrimary,
  headerShadowVisible: false,
  headerBackTitleVisible: false,
  headerBackButtonDisplayMode: 'minimal',
  contentStyle: { backgroundColor: authColors.canvas },
  animation: 'slide_from_right',
  gestureEnabled: true,
  ...(Platform.OS === 'ios' ? { fullScreenGestureEnabled: true } : {}),
}
