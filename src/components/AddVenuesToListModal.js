import { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  Modal,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { X } from 'lucide-react-native'
import { searchVenuesByName, fetchVenuesByIds } from '../lib/venueService'
import { addVenueToList } from '../utils/venueLists'
import { colors, fontSizes, fontFamilies, spacing, borderRadius } from '../theme'

const nid = (id) => {
  if (id == null) return null
  const n = parseInt(String(id), 10)
  return Number.isNaN(n) ? null : n
}

export default function AddVenuesToListModal({ visible, onClose, listId, listName, existingVenueIds = [], onAdded }) {
  const insets = useSafeAreaInsets()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [addingId, setAddingId] = useState(null)
  const [error, setError] = useState(null)
  const [justAdded, setJustAdded] = useState(() => new Set())

  const existingSet = new Set([...(existingVenueIds || []).map(nid).filter(Boolean), ...justAdded])

  const runSearch = useCallback(async () => {
    setSearching(true)
    setError(null)
    const { data: raw } = await searchVenuesByName(searchQuery, 25)
    const rows = raw || []
    const ids = rows.map((r) => nid(r.venue_id)).filter(Boolean)
    if (ids.length) {
      const { data: enriched } = await fetchVenuesByIds(ids)
      const map = new Map((enriched || []).map((v) => [v.venue_id, v]))
      setSearchResults(ids.map((id) => map.get(id) || rows.find((r) => nid(r.venue_id) === id)).filter(Boolean))
    } else {
      setSearchResults([])
    }
    setSearching(false)
  }, [searchQuery])

  useEffect(() => {
    if (!visible) return
    setSearchQuery('')
    setSearchResults([])
    setError(null)
    setJustAdded(new Set())
  }, [visible])

  useEffect(() => {
    if (!visible) return
    const t = setTimeout(() => runSearch(), searchQuery === '' ? 0 : 280)
    return () => clearTimeout(t)
  }, [searchQuery, visible, runSearch])

  const handleAdd = async (venue) => {
    const vid = nid(venue.venue_id)
    if (!vid || existingSet.has(vid)) return
    setAddingId(vid)
    setError(null)
    const { error: err } = await addVenueToList(listId, vid)
    setAddingId(null)
    if (err) {
      setError(err.message || 'Failed to add')
      return
    }
    setJustAdded((prev) => new Set([...prev, vid]))
    onAdded?.()
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.wrap, { paddingTop: insets.top }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Add to {listName || 'list'}
          </Text>
          <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
            <X size={22} color={colors.textPrimary} />
          </Pressable>
        </View>
        <TextInput
          style={styles.input}
          placeholder="Search venues by name..."
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {error ? <Text style={styles.errText}>{error}</Text> : null}
        {searching ? (
          <ActivityIndicator style={styles.loader} color={colors.browseAccent} />
        ) : (
          <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
            {searchResults.map((v) => {
              const id = nid(v.venue_id)
              const already = id != null && existingSet.has(id)
              return (
                <View key={v.venue_id} style={styles.row}>
                  <View style={styles.rowText}>
                    <Text style={styles.venueName} numberOfLines={2}>
                      {v.name || 'Venue'}
                    </Text>
                    {v.neighborhood_name ? (
                      <Text style={styles.venueMeta} numberOfLines={1}>
                        {v.neighborhood_name}
                      </Text>
                    ) : null}
                  </View>
                  <Pressable
                    style={[styles.addBtn, already && styles.addBtnDisabled]}
                    onPress={() => handleAdd(v)}
                    disabled={already || addingId === id}
                  >
                    {addingId === id ? (
                      <ActivityIndicator size="small" color={colors.backgroundElevated} />
                    ) : (
                      <Text style={styles.addBtnText}>{already ? 'Added' : 'Add'}</Text>
                    )}
                  </Pressable>
                </View>
              )
            })}
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.backgroundCanvas },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.base,
  },
  headerTitle: {
    flex: 1,
    fontSize: fontSizes.lg,
    fontFamily: fontFamilies.frauncesSemiBold,
    color: colors.textPrimary,
  },
  closeBtn: { padding: spacing.xs },
  input: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.base,
    paddingHorizontal: spacing.base,
    paddingVertical: 12,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: fontSizes.base,
    fontFamily: fontFamilies.inter,
    color: colors.textPrimary,
    backgroundColor: colors.backgroundElevated,
  },
  errText: { color: colors.error, marginHorizontal: spacing.lg, marginBottom: spacing.sm },
  loader: { marginTop: spacing.xl },
  list: { flex: 1, paddingHorizontal: spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.base,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowText: { flex: 1, marginRight: spacing.base },
  venueName: { fontSize: fontSizes.base, fontFamily: fontFamilies.interSemiBold, color: colors.textPrimary },
  venueMeta: { fontSize: fontSizes.xs, color: colors.textSecondary, marginTop: 2 },
  addBtn: {
    backgroundColor: colors.backgroundDark,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    minWidth: 72,
    alignItems: 'center',
  },
  addBtnDisabled: { backgroundColor: colors.textMuted },
  addBtnText: { color: colors.textOnDark, fontFamily: fontFamilies.interSemiBold, fontSize: fontSizes.sm },
})
