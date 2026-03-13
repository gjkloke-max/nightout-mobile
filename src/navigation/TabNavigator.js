import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { Text, TouchableOpacity } from 'react-native'
import { colors, fontSizes, spacing } from '../theme'
import BrowseScreen from '../screens/BrowseScreen'
import ChatScreen from '../screens/ChatScreen'
import SocialScreen from '../screens/SocialScreen'
import ProfileScreen from '../screens/ProfileScreen'
import ListDetailScreen from '../screens/ListDetailScreen'

const Tab = createBottomTabNavigator()
const Stack = createNativeStackNavigator()

function TabIcon({ label, focused }) {
  const icons = { Browse: '🔍', Chat: '💬', Social: '👥', Profile: '👤' }
  return <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.6 }}>{icons[label] || '•'}</Text>
}

function HeaderRight({ navigation }) {
  const openNotifications = () => {
    const root = navigation.getParent()?.getParent?.()
    root?.navigate?.('Notifications')
  }
  return (
    <TouchableOpacity onPress={openNotifications} style={{ padding: spacing.sm }} hitSlop={12}>
      <Text style={{ fontSize: 22 }}>🔔</Text>
    </TouchableOpacity>
  )
}

const screenOptions = ({ navigation }) => ({
  headerStyle: { backgroundColor: colors.backgroundElevated },
  headerTintColor: colors.textPrimary,
  headerShadowVisible: false,
  headerRight: () => <HeaderRight navigation={navigation} />,
})

function BrowseStack() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="BrowseMain" component={BrowseScreen} options={{ title: 'Browse' }} />
    </Stack.Navigator>
  )
}

function ChatStack() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="ChatMain" component={ChatScreen} options={{ title: 'Concierge' }} />
    </Stack.Navigator>
  )
}

function SocialStack() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="SocialMain" component={SocialScreen} options={{ title: 'Social' }} />
    </Stack.Navigator>
  )
}

function ProfileStack() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="ProfileMain" component={ProfileScreen} options={{ title: 'Profile' }} />
      <Stack.Screen name="ListDetail" component={ListDetailScreen} options={{ title: 'List' }} />
    </Stack.Navigator>
  )
}

export default function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused }) => <TabIcon label={route.name} focused={focused} />,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.backgroundElevated,
          borderTopColor: colors.borderLight,
        },
        tabBarLabelStyle: { fontSize: fontSizes.xs },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Browse" component={BrowseStack} />
      <Tab.Screen name="Chat" component={ChatStack} />
      <Tab.Screen name="Social" component={SocialStack} />
      <Tab.Screen name="Profile" component={ProfileStack} />
    </Tab.Navigator>
  )
}
