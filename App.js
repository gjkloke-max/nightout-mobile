import { useEffect } from 'react'
import { View, ActivityIndicator } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import * as WebBrowser from 'expo-web-browser'
import Constants from 'expo-constants'
import { NavigationContainer } from '@react-navigation/native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { useFonts } from 'expo-font'
import { AuthProvider } from './src/contexts/AuthContext'
import { logDevOAuthRedirectUrl } from './src/services/oauthSupabase'
import { colors } from './src/theme'
import AppNavigator from './src/navigation/AppNavigator'
import AppUpdateGate from './src/components/AppUpdateGate'
import { navigationRef } from './src/navigation/navigationRef'
// Registers the foreground notification handler at startup.
import './src/services/pushNotifications'

WebBrowser.maybeCompleteAuthSession()

function AppContent() {
  const [fontsLoaded] = useFonts({
    Fraunces_400Regular: require('@expo-google-fonts/fraunces/400Regular').Fraunces_400Regular,
    Fraunces_400Regular_Italic: require('@expo-google-fonts/fraunces/400Regular_Italic').Fraunces_400Regular_Italic,
    Fraunces_600SemiBold: require('@expo-google-fonts/fraunces/600SemiBold').Fraunces_600SemiBold,
    Fraunces_700Bold: require('@expo-google-fonts/fraunces/700Bold').Fraunces_700Bold,
    Inter_400Regular: require('@expo-google-fonts/inter/400Regular').Inter_400Regular,
    Inter_500Medium: require('@expo-google-fonts/inter/500Medium').Inter_500Medium,
    Inter_600SemiBold: require('@expo-google-fonts/inter/600SemiBold').Inter_600SemiBold,
    Inter_700Bold: require('@expo-google-fonts/inter/700Bold').Inter_700Bold,
  })

  useEffect(() => {
    if (fontsLoaded) logDevOAuthRedirectUrl()
  }, [fontsLoaded])

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.browseAccent} />
      </View>
    )
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Asks for an update, or requires one, by the build numbers in app_release_config. */}
      <AppUpdateGate>
        <AppNavigator />
      </AppUpdateGate>
      <StatusBar style="dark" />
    </View>
  )
}

/** Deep-link prefixes without importing expo-linking (avoids Metro resolve issues on some installs). */
function getLinkingPrefixes() {
  const prefixes = ['nightout://']
  const hostUri = Constants.expoConfig?.hostUri
  if (hostUri) {
    const host = hostUri.split('/')[0]
    prefixes.push(`exp://${host}`)
  }
  return prefixes
}

const linking = {
  prefixes: getLinkingPrefixes(),
  config: {
    screens: {
      VenueProfile: {
        path: 'venue/:venueId',
        parse: {
          venueId: (id) => String(id),
        },
      },
    },
  },
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer ref={navigationRef} linking={linking}>
          <AppContent />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  )
}
