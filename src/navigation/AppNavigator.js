import { View, ActivityIndicator, StyleSheet } from 'react-native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { colors, fontSizes, fontWeights } from '../theme'
import { useAuth } from '../contexts/AuthContext'
import TabNavigator from './TabNavigator'
import LoginScreen from '../screens/LoginScreen'
import NotificationsScreen from '../screens/NotificationsScreen'
import VenueProfileScreen from '../screens/VenueProfileScreen'
import WriteReviewScreen from '../screens/WriteReviewScreen'
import FriendProfileScreen from '../screens/FriendProfileScreen'

const Stack = createNativeStackNavigator()

export default function AppNavigator() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    )
  }

  if (!user) {
    return <LoginScreen />
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.backgroundElevated },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: { fontSize: fontSizes.lg, fontWeight: fontWeights.semibold },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="MainTabs"
        component={TabNavigator}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="VenueProfile"
        component={VenueProfileScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="FriendProfile"
        component={FriendProfileScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="WriteReview"
        component={WriteReviewScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ title: 'Notifications' }}
      />
    </Stack.Navigator>
  )
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
})
