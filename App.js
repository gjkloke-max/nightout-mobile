import { View, ActivityIndicator } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { NavigationContainer } from '@react-navigation/native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { useFonts } from 'expo-font'
import { AuthProvider } from './src/contexts/AuthContext'
import { colors } from './src/theme'
import AppNavigator from './src/navigation/AppNavigator'

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

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    )
  }

  return (
    <View style={{ flex: 1 }}>
      <AppNavigator />
      <StatusBar style="dark" />
    </View>
  )
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer>
          <AppContent />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  )
}
