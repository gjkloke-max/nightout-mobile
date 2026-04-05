import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { colors, fontSizes, fontFamilies } from '../theme'
import { TabIcon } from '../components/TabIcons'
import NotificationsBellButton from '../components/NotificationsBellButton'
import BrowseScreen from '../screens/BrowseScreen'
import ChatScreen from '../screens/ChatScreen'
import SocialScreen from '../screens/SocialScreen'
import SocialReviewDetailScreen from '../screens/SocialReviewDetailScreen'
import ProfileScreen from '../screens/ProfileScreen'
import EditProfileScreen from '../screens/EditProfileScreen'
import NotificationSettingsScreen from '../screens/NotificationSettingsScreen'
import SettingsScreen from '../screens/SettingsScreen'
import AccountPrivacyScreen from '../screens/AccountPrivacyScreen'
import ListDetailScreen from '../screens/ListDetailScreen'

const Tab = createBottomTabNavigator()
const Stack = createNativeStackNavigator()

const screenOptions = () => ({
  headerStyle: { backgroundColor: colors.backgroundElevated },
  headerTintColor: colors.textPrimary,
  headerTitleStyle: { fontSize: fontSizes.lg, fontFamily: fontFamilies.frauncesSemiBold },
  headerShadowVisible: false,
  headerRight: () => <NotificationsBellButton />,
})

function BrowseStack() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="BrowseMain"
        component={BrowseScreen}
        options={{
          headerShown: false,
        }}
      />
    </Stack.Navigator>
  )
}

function ChatStack() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="ChatMain" component={ChatScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  )
}

function SocialStack() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="SocialMain" component={SocialScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="SocialReviewDetail"
        component={SocialReviewDetailScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  )
}

function ProfileStack() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="ProfileMain"
        component={ProfileScreen}
        options={{ title: '', headerShown: false }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ headerShown: true, title: 'Settings', headerRight: () => null }}
      />
      <Stack.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{ title: 'Edit Profile', headerShown: true }}
      />
      <Stack.Screen
        name="NotificationSettings"
        component={NotificationSettingsScreen}
        options={{ title: 'Notification Settings', headerShown: true }}
      />
      <Stack.Screen
        name="AccountPrivacy"
        component={AccountPrivacyScreen}
        options={{ headerShown: true, title: 'Account Privacy', headerRight: () => null }}
      />
      <Stack.Screen name="ListDetail" component={ListDetailScreen} options={{ title: 'List' }} />
    </Stack.Navigator>
  )
}

export default function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color }) => <TabIcon label={route.name} focused={focused} color={color} />,
        tabBarActiveTintColor: colors.browseAccent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: 'rgba(255,255,255,0.9)',
          borderTopColor: 'rgba(228,228,231,0.5)',
        },
        tabBarLabelStyle: {
          fontSize: fontSizes.micro,
          fontFamily: fontFamilies.frauncesSemiBold,
          letterSpacing: 0.5,
        },
        tabBarHideOnKeyboard: true,
        headerShown: false,
      })}
    >
      <Tab.Screen name="Browse" component={BrowseStack} options={{ headerShown: false }} />
      <Tab.Screen name="Chat" component={ChatStack} options={{ headerShown: false }} />
      <Tab.Screen name="Social" component={SocialStack} options={{ headerShown: false }} />
      <Tab.Screen name="Profile" component={ProfileStack} options={{ headerShown: false }} />
    </Tab.Navigator>
  )
}
