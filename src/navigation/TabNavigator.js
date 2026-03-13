import { useState, useEffect } from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { View, TouchableOpacity } from 'react-native'
import { colors, fontSizes, spacing } from '../theme'
import { getUnreadCount } from '../services/notifications'
import { useAuth } from '../contexts/AuthContext'
import { TabIcon } from '../components/TabIcons'
import { Bell } from 'lucide-react-native'
import { iconSizes } from '../theme/icons'
import BrowseScreen from '../screens/BrowseScreen'
import ChatScreen from '../screens/ChatScreen'
import SocialScreen from '../screens/SocialScreen'
import ProfileScreen from '../screens/ProfileScreen'
import ListDetailScreen from '../screens/ListDetailScreen'

const Tab = createBottomTabNavigator()
const Stack = createNativeStackNavigator()

function HeaderRight({ navigation }) {
  const { user } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!user?.id) return
    const refresh = () => getUnreadCount(user.id).then(setUnreadCount)
    refresh()
    const interval = setInterval(refresh, 15000)
    return () => clearInterval(interval)
  }, [user?.id])

  const openNotifications = () => {
    const root = navigation.getParent()?.getParent?.()
    root?.navigate?.('Notifications')
  }
  return (
    <TouchableOpacity onPress={openNotifications} style={{ padding: spacing.sm, position: 'relative' }} hitSlop={12}>
      <Bell size={iconSizes.header} color={colors.textPrimary} strokeWidth={2} />
      {unreadCount > 0 && (
        <View style={{
          position: 'absolute',
          top: 6,
          right: 6,
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: colors.error,
        }} />
      )}
    </TouchableOpacity>
  )
}

const screenOptions = ({ navigation }) => ({
  headerStyle: { backgroundColor: 'rgba(250,250,250,0.8)' },
  headerTintColor: colors.textPrimary,
  headerTitleStyle: { fontSize: fontSizes.lg, fontWeight: '700', fontFamily: 'Fraunces_700Bold' },
  headerShadowVisible: false,
  headerRight: () => <HeaderRight navigation={navigation} />,
})

function BrowseStack() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="BrowseMain" component={BrowseScreen} options={{ title: '' }} />
    </Stack.Navigator>
  )
}

function ChatStack() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="ChatMain" component={ChatScreen} options={{ title: '' }} />
    </Stack.Navigator>
  )
}

function SocialStack() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="SocialMain" component={SocialScreen} options={{ title: '' }} />
    </Stack.Navigator>
  )
}

function ProfileStack() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="ProfileMain" component={ProfileScreen} options={{ title: '' }} />
      <Stack.Screen name="ListDetail" component={ListDetailScreen} options={{ title: 'List' }} />
    </Stack.Navigator>
  )
}

export default function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color }) => <TabIcon label={route.name} focused={focused} color={color} />,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: 'rgba(255,255,255,0.9)',
          borderTopColor: 'rgba(228,228,231,0.5)',
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600', fontFamily: 'Fraunces_600SemiBold' },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Browse" component={BrowseStack} options={{ headerShown: true }} />
      <Tab.Screen name="Chat" component={ChatStack} options={{ headerShown: true }} />
      <Tab.Screen name="Social" component={SocialStack} options={{ headerShown: true }} />
      <Tab.Screen name="Profile" component={ProfileStack} options={{ headerShown: true }} />
    </Tab.Navigator>
  )
}
