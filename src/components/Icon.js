/**
 * Shared Icon component — Lucide React Native.
 * Provides consistent sizing, color, and stroke across the app.
 *
 * Usage:
 *   <Icon name="Heart" size="card" color={colors.accent} />
 *   <Icon name="MapPin" size="inline" />
 */
import React from 'react'
import {
  Compass,
  MessageCircle,
  Users,
  User,
  Bell,
  Bookmark,
  BookmarkCheck,
  Heart,
  HeartOff,
  Plus,
  MessageSquare,
  MapPin,
  Globe,
  Image as ImageIcon,
  Pencil,
  MoreHorizontal,
  Search,
  ListPlus,
  X,
  Send,
} from 'lucide-react-native'
import { iconSizes, iconStrokeWidth } from '../theme/icons'
import { colors } from '../theme'

// Re-export for direct use in tab bar etc.
export { Compass, MessageCircle, Users, User, Bell } from 'lucide-react-native'

const ICON_MAP = {
  Compass,
  MessageCircle,
  Users,
  User,
  Bell,
  Bookmark,
  BookmarkCheck,
  Heart,
  HeartOff,
  Plus,
  MessageSquare,
  MapPin,
  Globe,
  Image: ImageIcon,
  Pencil,
  MoreHorizontal,
  Search,
  ListPlus,
  X,
  Send,
}

export function Icon({
  name,
  size = 'inline',
  color,
  strokeWidth,
  style,
  ...props
}) {
  const Component = ICON_MAP[name]
  if (!Component) {
    console.warn(`[Icon] Unknown icon: ${name}`)
    return null
  }

  const pixelSize = typeof size === 'number' ? size : iconSizes[size] ?? iconSizes.inline
  const stroke = strokeWidth ?? iconStrokeWidth.default
  const iconColor = color ?? colors.textPrimary

  return (
    <Component
      size={pixelSize}
      color={iconColor}
      strokeWidth={stroke}
      style={style}
      {...props}
    />
  )
}

export default Icon
