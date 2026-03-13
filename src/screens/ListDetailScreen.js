import { useState, useEffect } from 'react'
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native'
import { useRoute, useNavigation } from '@react-navigation/native'
import { getListWithItems, removeVenueFromList } from '../utils/venueLists'
import VenueCard from '../components/VenueCard'
import { colors, fontSizes, fontWeights, spacing } from '../theme'

export default function ListDetailScreen() {
  const route = useRoute()
  const navigation = useNavigation()
  const listId = route?.params?.listId

  const [list, setList] = useState(null)
  const [loading, setLoading] = useState(true)
  const [removingId, setRemovingId] = useState(null)

  useEffect(() => {
    if (listId) loadList()
  }, [listId])

  const loadList = async () => {
    setLoading(true)
    const { data, error } = await getListWithItems(listId)
    setList(data)
    setLoading(false)
  }

  const handleVenuePress = (venue) => {
    const root = navigation.getParent()?.getParent?.()
    root?.navigate?.('VenueProfile', { venueId: venue?.venue_id })
  }

  const handleRemove = async (listItemId) => {
    setRemovingId(listItemId)
    await removeVenueFromList(listItemId)
    setList((prev) => prev ? { ...prev, items: prev.items.filter((i) => i.list_item_id !== listItemId) } : null)
    setRemovingId(null)
  }

  if (!listId) {
    return <Text style={styles.error}>No list specified</Text>
  }

  if (loading && !list) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    )
  }

  if (!list) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>List not found</Text>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>Go back</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{list.list_name}</Text>
      <Text style={styles.count}>{list.items?.length || 0} venues</Text>
      <View style={styles.items}>
        {(list.items || []).map((item) => (
          <View key={item.list_item_id} style={styles.itemRow}>
            <VenueCard venue={item.venue} onPress={() => handleVenuePress(item.venue)} />
            <Pressable
              style={styles.removeBtn}
              onPress={() => handleRemove(item.list_item_id)}
              disabled={removingId === item.list_item_id}
            >
              {removingId === item.list_item_id ? (
                <ActivityIndicator size="small" color={colors.error} />
              ) : (
                <Text style={styles.removeBtnText}>Remove</Text>
              )}
            </Pressable>
          </View>
        ))}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  error: { fontSize: fontSizes.base, color: colors.textMuted, marginBottom: spacing.lg },
  backBtn: { padding: spacing.base },
  backBtnText: { color: colors.link },
  title: { fontSize: fontSizes['2xl'], fontWeight: fontWeights.semibold, color: colors.textPrimary, marginBottom: spacing.xs },
  count: { fontSize: fontSizes.sm, color: colors.textMuted, marginBottom: spacing.lg },
  items: { gap: spacing.lg },
  itemRow: { marginBottom: spacing.base },
  removeBtn: { marginTop: spacing.xs, paddingVertical: spacing.sm },
  removeBtnText: { fontSize: fontSizes.sm, color: colors.error },
})
