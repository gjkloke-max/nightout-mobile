import { useLayoutEffect, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Alert } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Pencil, Bell, SlidersHorizontal, Lock, Shield, FileText, LogOut, Trash2, ChevronRight } from 'lucide-react-native'
import { useAuth } from '../contexts/AuthContext'
import { colors, fontFamilies, spacing } from '../theme'
import { config } from '../lib/config'

/** Figma NewCo — node 123:2399 Settings */
export default function SettingsScreen() {
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const { signOut, deleteAccount } = useAuth()
  const [deleting, setDeleting] = useState(false)

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

  // Two taps, with the destructive one second and the wording explicit about what goes. Apple wants
  // deletion startable in the app (Guideline 5.1.1(v)); it does not want it easy to do by accident.
  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete account?',
      'This permanently deletes your account, along with your profile, saved venues, lists, reviews and messages. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Are you sure?', 'Your account and all of its data will be deleted immediately.', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete my account',
                style: 'destructive',
                onPress: async () => {
                  setDeleting(true)
                  const { error } = await deleteAccount()
                  setDeleting(false)
                  // On success the auth state change unmounts this screen, so only the failure
                  // path needs to say anything.
                  if (error) Alert.alert('Could not delete account', error.message)
                },
              },
            ])
          },
        },
      ],
    )
  }

  const openLegal = (path) => {
    const base = (config.webAppUrl || '').replace(/\/$/, '')
    if (!base) return
    Linking.openURL(`${base}${path}`)
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
          onPress={() => navigation.navigate('EditPreferences')}
          activeOpacity={0.65}
        >
          <View style={styles.rowLeft}>
            <SlidersHorizontal size={20} color={colors.textPrimary} strokeWidth={2} />
            <Text style={styles.rowLabel}>Edit Preferences</Text>
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

        <TouchableOpacity
          style={[styles.row, styles.rowBorder]}
          onPress={() => openLegal('/privacy')}
          activeOpacity={0.65}
          disabled={!config.webAppUrl}
        >
          <View style={styles.rowLeft}>
            <Shield size={20} color={colors.textPrimary} strokeWidth={2} />
            <Text style={styles.rowLabel}>Privacy Policy</Text>
          </View>
          <ChevronRight size={20} color={colors.textMuted} strokeWidth={2} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.row, styles.rowBorder]}
          onPress={() => openLegal('/terms')}
          activeOpacity={0.65}
          disabled={!config.webAppUrl}
        >
          <View style={styles.rowLeft}>
            <FileText size={20} color={colors.textPrimary} strokeWidth={2} />
            <Text style={styles.rowLabel}>Terms of Service</Text>
          </View>
          <ChevronRight size={20} color={colors.textMuted} strokeWidth={2} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.row} onPress={handleLogout} activeOpacity={0.65}>
          <View style={styles.rowLeft}>
            <LogOut size={20} color={colors.profileAccent} strokeWidth={2} />
            <Text style={styles.logoutLabel}>Logout</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.row}
          onPress={handleDeleteAccount}
          activeOpacity={0.65}
          disabled={deleting}
        >
          <View style={styles.rowLeft}>
            <Trash2 size={20} color={colors.error} strokeWidth={2} />
            <Text style={styles.deleteLabel}>{deleting ? 'Deleting account...' : 'Delete Account'}</Text>
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
  deleteLabel: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fontFamilies.interMedium,
    color: colors.error,
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
