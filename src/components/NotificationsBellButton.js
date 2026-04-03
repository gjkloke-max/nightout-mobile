import { useState, useEffect } from 'react'
import { TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { Bell } from 'lucide-react-native'
import { useAuth } from '../contexts/AuthContext'
import { getUnreadCount } from '../services/notifications'
import { colors, spacing } from '../theme'
import { iconSizes } from '../theme/icons'

/** Same behavior as TabNavigator HeaderRight — use when the stack header is hidden (Profile-style layout). */
export default function NotificationsBellButton() {
  const navigation = useNavigation()
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
        <View
          style={{
            position: 'absolute',
            top: 6,
            right: 6,
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: colors.error,
          }}
        />
      )}
    </TouchableOpacity>
  )
}
