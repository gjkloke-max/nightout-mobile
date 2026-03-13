import React from 'react'
import { Compass, MessageCircle, Users, User } from 'lucide-react-native'
import { iconSizes } from '../theme/icons'

const ICON_SIZE = iconSizes.nav

export function TabIcon({ label, focused, color }) {
  const iconProps = { size: ICON_SIZE, color, strokeWidth: 2 }

  switch (label) {
    case 'Browse':
      return <Compass {...iconProps} />
    case 'Chat':
      return <MessageCircle {...iconProps} />
    case 'Social':
      return <Users {...iconProps} />
    case 'Profile':
      return <User {...iconProps} />
    default:
      return null
  }
}
