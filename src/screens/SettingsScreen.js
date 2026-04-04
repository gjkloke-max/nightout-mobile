import { useLayoutEffect } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Pencil, Bell, Lock, LogOut, ChevronRight } from 'lucide-react-native'
import { useAuth } from '../contexts/AuthContext'
import { colors, fontFamilies, spacing } from '../theme'

/** Figma NewCo — node 123:2399 Settings */
export default function SettingsScreen() {
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const { signOut } = useAuth()

  useLayoutEffect(() => {
    navigation.setOptions({
      title: 'Settings',
      headerTitleStyle: {
        fontFamily: fontFamilies.frauncesRegular,
        fontSize: 24,
        color: colors.textPrimary,
      },
      headerStyle: {
        backgroundColor: colors.backgroundElevated,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.border,
      },
      headerShadowVisible: false,
      headerRight: () => null,
      headerBackTitleVisible: false,
    })
  }, [navigation])

  const handleLogout = async () => {
    await signOut()
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(spacing['2xl'], insets.bottom + spacing.xl) }]}
    >
      <View style={styles.listCard}>
        <TouchableOpacity
          style={[styles.row, styles.rowBorder]}
          onPress={() => navigation.navigate('EditProfile')}
          activeOpacity={0.65}
        >
          <View style={styles.rowLeft}>
            <Pencil size={20} color={colors.textPrimary} strokeWidth={2} />
            <Text style={styles.rowLabel}>Edit Profile</Text>
          </View>
          <ChevronRight size={20} color={colors.textMuted} strokeWidth={2} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.row, styles.rowBorder]}
          onPress={() => navigation.navigate('NotificationSettings')}
          activeOpacity={0.65}
        >
          <View style={styles.rowLeft}>
            <Bell size={20} color={colors.textPrimary} strokeWidth={2} />
            <Text style={styles.rowLabel}>Notification Settings</Text>
          </View>
          <ChevronRight size={20} color={colors.textMuted} strokeWidth={2} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.row, styles.rowBorder]}
          onPress={() => navigation.navigate('AccountPrivacy')}
          activeOpacity={0.65}
        >
          <View style={styles.rowLeft}>
            <Lock size={20} color={colors.textPrimary} strokeWidth={2} />
            <Text style={styles.rowLabel}>Account Privacy</Text>
          </View>
          <ChevronRight size={20} color={colors.textMuted} strokeWidth={2} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.row} onPress={handleLogout} activeOpacity={0.65}>
          <View style={styles.rowLeft}>
            <LogOut size={20} color={colors.profileAccent} strokeWidth={2} />
            <Text style={styles.logoutLabel}>Logout</Text>
          </View>
        </TouchableOpacity>
      </View>

      <Text style={styles.version}>Version 1.0.0</Text>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: colors.backgroundCanvas,
  },
  scrollContent: {
    paddingTop: 0,
  },
  listCard: {
    backgroundColor: colors.backgroundElevated,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 61,
    paddingHorizontal: 24,
    paddingVertical: 18,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F4F4F5',
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
    minWidth: 0,
  },
  rowLabel: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fontFamilies.interMedium,
    color: colors.textPrimary,
  },
  logoutLabel: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fontFamilies.interMedium,
    color: colors.profileAccent,
  },
  version: {
    marginTop: spacing.xl,
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'Georgia',
    fontStyle: 'italic',
    color: colors.textTag,
  },
})
