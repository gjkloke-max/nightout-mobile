import { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Image,
  ActivityIndicator,
} from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ChevronLeft } from 'lucide-react-native'
import { getUserReviewedVenuesSorted } from '../services/userTopTen'
import { colors, fontSizes, fontFamilies, spacing } from '../theme'

export default function ReviewedVenuesListScreen() {
  const navigation = useNavigation()
  const route = useRoute()
  const insets = useSafeAreaInsets()
  const userId = route.params?.userId

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      const data = await getUserReviewedVenuesSorted(userId)
      setRows(data || [])
    } catch (e) {
      console.error(e)
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    load()
  }, [load])

  const openVenue = (venueId) => {
    navigation.navigate('VenueProfile', { venueId })
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={12}>
          <ChevronLeft size={22} color={colors.textPrimary} strokeWidth={2} />
          <Text style={styles.backText}>BACK</Text>
        </Pressable>
        <Text style={styles.title}>Reviewed venues</Text>
        <View style={{ width: 72 }} />
      </View>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.browseAccent} />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => String(item.venue_id)}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<Text style={styles.empty}>No venues yet.</Text>}
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => openVenue(item.venue_id)}>
              <View style={styles.thumbWrap}>
                {item.primary_photo_url ? (
                  <Image source={{ uri: item.primary_photo_url }} style={styles.thumb} />
                ) : (
                  <View style={[styles.thumb, styles.thumbPh]} />
                )}
              </View>
              <View style={styles.textCol}>
                <Text style={styles.venueName} numberOfLines={1}>
                  {item.venue_name}
                </Text>
                {item.neighborhood_name ? (
                  <Text style={styles.hood} numberOfLines={1}>
                    {String(item.neighborhood_name).toUpperCase()}
                  </Text>
                ) : null}
              </View>
              <Text style={styles.score}>{item.user_score.toFixed(1)}</Text>
            </Pressable>
          )}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.backgroundCanvas },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: { fontSize: 11, fontFamily: fontFamilies.interBold, letterSpacing: 1 },
  title: { fontSize: fontSizes.lg, fontFamily: fontFamilies.fraunces, color: colors.textPrimary },
  listContent: { paddingBottom: spacing['3xl'] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  thumbWrap: {},
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  thumbPh: { backgroundColor: colors.surface },
  textCol: { flex: 1, minWidth: 0 },
  venueName: { fontSize: fontSizes.md, fontFamily: fontFamilies.fraunces, color: colors.textPrimary },
  hood: { fontSize: 10, fontFamily: fontFamilies.interBold, color: colors.textTag, marginTop: 2 },
  score: { fontSize: fontSizes.md, fontFamily: fontFamilies.fraunces, color: colors.textPrimary },
  empty: { textAlign: 'center', color: colors.textSecondary, marginTop: spacing.xl, paddingHorizontal: spacing.xl },
})
