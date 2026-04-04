import { useState, useEffect } from 'react'
import { TouchableOpacity, View, DeviceEventEmitter } from 'react-native'
import { CommonActions, useNavigation } from '@react-navigation/native'
import { Bell } from 'lucide-react-native'
import { useAuth } from '../contexts/AuthContext'
import { getUnseenCount } from '../services/notifications'
import { colors, spacing } from '../theme'
import { iconSizes } from '../theme/icons'

const BADGE_REFRESH = 'notification-badge-refresh'

/** Same behavior as TabNavigator HeaderRight — use when the stack header is hidden (Profile-style layout). */
export default function NotificationsBellButton() {
  const navigation = useNavigation()
  const { user } = useAuth()
  const [unseenCount, setUnseenCount] = useState(0)

  useEffect(() => {
    if (!user?.id) return
    const refresh = () => getUnseenCount(user.id).then(setUnseenCount)
    refresh()
    const interval = setInterval(refresh, 15000)
    const sub = DeviceEventEmitter.addListener(BADGE_REFRESH, refresh)
    return () => {
      clearInterval(interval)
      sub.remove()
    }
  }, [user?.id])

  const openNotifications = () => {
    // Root Stack screen (sibling to MainTabs). CommonActions works from nested tab/stack headers.
    navigation.dispatch(
      CommonActions.navigate({
        name: 'Notifications',
      })
    )
  }

  return (
    <TouchableOpacity onPress={openNotifications} style={{ padding: spacing.sm, position: 'relative' }} hitSlop={12}>
      <Bell size={iconSizes.header} color={colors.textPrimary} strokeWidth={2} />
      {unseenCount > 0 && (
        <View
          style={{
            position: 'absolute',
            top: 6,
            right: 6,
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: colors.browseAccent,
          }}
        />
      )}
    </TouchableOpacity>
  )
}
