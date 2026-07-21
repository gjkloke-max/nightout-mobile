import { useEffect, useRef } from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { authColors } from '../theme/authTheme'
import { onboardingStackScreenOptions } from '../theme/onboardingStackScreenOptions'
import LandingScreen from '../screens/auth/LandingScreen'
import SignInScreen from '../screens/auth/SignInScreen'
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen'
import GetStartedScreen from '../screens/auth/GetStartedScreen'

const Stack = createNativeStackNavigator()

export default function AuthStackNavigator() {
  const instanceId = useRef(Math.random().toString(36).slice(2, 8))
  console.log(`[DEBUG_NAV] AuthStackNavigator render, instance=${instanceId.current}`)
  useEffect(() => {
    console.log(`[DEBUG_NAV] AuthStackNavigator MOUNTED, instance=${instanceId.current}`)
    return () => {
      console.log(`[DEBUG_NAV] AuthStackNavigator UNMOUNTED, instance=${instanceId.current}`)
    }
  }, [])

  return (
    <Stack.Navigator
      initialRouteName="Landing"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: authColors.canvas },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="Landing" component={LandingScreen} />
      <Stack.Screen name="SignIn" component={SignInScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="GetStarted" component={GetStartedScreen} options={onboardingStackScreenOptions} />
    </Stack.Navigator>
  )
}
