import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { authColors } from '../theme/authTheme'
import AboutYouScreen from '../screens/auth/AboutYouScreen'
import PreferencesOnboardingScreen from '../screens/auth/PreferencesOnboardingScreen'
import GetStartedScreen from '../screens/auth/GetStartedScreen'

const Stack = createNativeStackNavigator()

function initialRouteNameForStep(step) {
  if (step === 'preferences') return 'PreferencesOnboarding'
  if (step === 'get_started') return 'GetStarted'
  return 'AboutYou'
}

/**
 * @param {{ initialStep?: string }} props
 */
export default function OnboardingStackNavigator({ initialStep }) {
  const initial = initialRouteNameForStep(initialStep)

  return (
    <Stack.Navigator
      initialRouteName={initial}
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: authColors.canvas },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="GetStarted" component={GetStartedScreen} />
      <Stack.Screen name="AboutYou" component={AboutYouScreen} />
      <Stack.Screen name="PreferencesOnboarding" component={PreferencesOnboardingScreen} />
    </Stack.Navigator>
  )
}
