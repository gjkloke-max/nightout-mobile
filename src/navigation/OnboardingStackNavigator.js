import { useEffect, useRef } from 'react'
import { View, ActivityIndicator, StyleSheet } from 'react-native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import AboutYouScreen from '../screens/auth/AboutYouScreen'
import PreferencesOnboardingScreen from '../screens/auth/PreferencesOnboardingScreen'
import GetStartedScreen from '../screens/auth/GetStartedScreen'
import { onboardingStackScreenOptions } from '../theme/onboardingStackScreenOptions'
import { authColors } from '../theme/authTheme'

const Stack = createNativeStackNavigator()

function initialRouteNameForStep(step) {
  if (step === 'preferences') return 'PreferencesOnboarding'
  if (step === 'get_started') return 'GetStarted'
  return 'AboutYou'
}

/**
 * react-navigation's native-stack only produces a clean, single-entry stack when
 * initialRouteName is the FIRST-declared screen (GetStarted here) - pointing it at a later screen
 * (AboutYou/PreferencesOnboarding) instead leaves the screens before it in the declaration order
 * still present in the navigation state underneath it (confirmed via navigation.getState()), which
 * is exactly what broke back navigation - tapping back could land you on GetStarted again instead
 * of exiting. So always mount at GetStarted (guaranteed single entry), then explicitly reset to the
 * real starting screen right after mount if it isn't GetStarted.
 */
function OnboardingEntryScreen({ navigation, route, targetRouteName }) {
  const isRedirecting = targetRouteName !== 'GetStarted'

  useEffect(() => {
    if (!isRedirecting) return
    // Dispatching immediately on mount can fire before this navigator has fully registered its
    // routes ("action was not handled by any navigator") - defer one tick so it's ready.
    const t = setTimeout(() => {
      navigation.reset({ index: 0, routes: [{ name: targetRouteName }] })
    }, 0)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (isRedirecting) {
    return (
      <View style={styles.redirecting}>
        <ActivityIndicator size="large" color={authColors.accent} />
      </View>
    )
  }

  return <GetStartedScreen navigation={navigation} route={route} />
}

/**
 * @param {{ initialStep?: string }} props
 */
export default function OnboardingStackNavigator({ initialStep }) {
  // Captured once at mount - later initialStep prop changes (e.g. profile advancing to the next
  // step) must not re-trigger this redirect on an already-running session.
  const targetRouteNameRef = useRef(initialRouteNameForStep(initialStep))

  return (
    <Stack.Navigator initialRouteName="GetStarted" screenOptions={onboardingStackScreenOptions}>
      <Stack.Screen name="GetStarted">
        {(props) => <OnboardingEntryScreen {...props} targetRouteName={targetRouteNameRef.current} />}
      </Stack.Screen>
      <Stack.Screen name="AboutYou" component={AboutYouScreen} />
      <Stack.Screen name="PreferencesOnboarding" component={PreferencesOnboardingScreen} />
    </Stack.Navigator>
  )
}

const styles = StyleSheet.create({
  redirecting: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: authColors.canvas },
})
