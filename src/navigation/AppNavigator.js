import { View, ActivityIndicator, StyleSheet } from 'react-native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { colors, fontSizes, fontFamilies } from '../theme'
import { useAuth } from '../contexts/AuthContext'
import TabNavigator from './TabNavigator'
import LoginScreen from '../screens/LoginScreen'
import NotificationsScreen from '../screens/NotificationsScreen'
import VenueProfileScreen from '../screens/VenueProfileScreen'
import WriteReviewScreen from '../screens/WriteReviewScreen'
import FriendProfileScreen from '../screens/FriendProfileScreen'
import SocialReviewDetailScreen from '../screens/SocialReviewDetailScreen'
import ListDetailScreen from '../screens/ListDetailScreen'
import FollowListScreen from '../screens/FollowListScreen'
import ReviewedVenuesListScreen from '../screens/ReviewedVenuesListScreen'
import DMMessagesHomeScreen from '../screens/DMMessagesHomeScreen'
import DMConversationScreen from '../screens/DMConversationScreen'
import DMNewMessageScreen from '../screens/DMNewMessageScreen'

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
        headerTitleStyle: {
          fontSize: fontSizes.lg,
          fontFamily: fontFamilies.frauncesSemiBold,
        },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.backgroundCanvas },
        animation: 'slide_from_right',
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
      {/* Same screens as tab stacks, registered here so opening from Notifications keeps back → Notifications */}
      <Stack.Screen
        name="SocialReviewDetail"
        component={SocialReviewDetailScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen name="ListDetail" component={ListDetailScreen} options={{ title: 'List' }} />
      <Stack.Screen name="FollowList" component={FollowListScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ReviewedVenuesList" component={ReviewedVenuesListScreen} options={{ headerShown: false }} />
      <Stack.Screen name="DMMessagesHome" component={DMMessagesHomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="DMConversation" component={DMConversationScreen} options={{ headerShown: false }} />
      <Stack.Screen name="DMNewMessage" component={DMNewMessageScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  )
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.backgroundCanvas },
})
