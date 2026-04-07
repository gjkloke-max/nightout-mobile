import { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Search } from 'lucide-react-native'
import { searchVenuesByName, fetchVenuesByIds } from '../lib/venueService'
import { createList, addVenueToList } from '../utils/venueLists'
import { colors, fontSizes, fontWeights, fontFamilies, spacing } from '../theme'

const nid = (id) => {
  if (id == null) return null
  const n = parseInt(String(id), 10)
  return Number.isNaN(n) ? null : n
}

function neighborhoodLabel(v) {
  const n = (v?.neighborhood_name || '').trim()
  if (n) return n.toUpperCase()
  const city = (v?.city || '').trim()
  const s = Array.isArray(v?.state) ? v.state[0] : v?.state
  const code = s?.state_code || ''
  if (city && code) return `${city}, ${code}`.toUpperCase()
  return (city || '').toUpperCase()
}

export default function CreateListScreen() {
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const [listName, setListName] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [selectedVenues, setSelectedVenues] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const selectedIds = new Set(selectedVenues.map((v) => nid(v.venue_id)).filter(Boolean))

  const runSearch = useCallback(async () => {
    setSearching(true)
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
    const t = setTimeout(runSearch, 280)
    return () => clearTimeout(t)
  }, [searchQuery, runSearch])

  const handleAdd = (venue) => {
    const vid = nid(venue.venue_id)
    if (!vid || selectedIds.has(vid)) return
    setSelectedVenues((prev) => [...prev, venue])
  }

  const handleRemove = (venueId) => {
    setSelectedVenues((prev) => prev.filter((v) => nid(v.venue_id) !== nid(venueId)))
  }

  const handleSave = async () => {
    const name = listName.trim()
    if (!name) {
      setError('Enter a list name')
      return
    }
    setError(null)
    setSaving(true)
    const { data, error: ce } = await createList(name, { list_visibility: 'public' })
    if (ce || !data?.list_id) {
      setError(ce?.message || 'Could not create list')
      setSaving(false)
      return
    }
    const listId = data.list_id
    for (const v of selectedVenues) {
      const vid = nid(v.venue_id)
      if (vid) await addVenueToList(listId, vid)
    }
    setSaving(false)
    navigation.replace('ListDetail', { listId })
  }

  const saveDisabled = saving || !listName.trim()

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.goBack()} style={styles.topBtn} hitSlop={12}>
          <Text style={styles.topBtnText}>×</Text>
        </Pressable>
        <Pressable
          onPress={handleSave}
          disabled={saveDisabled}
          style={[styles.saveBtn, saveDisabled && styles.saveBtnDisabled]}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveBtnText}>SAVE</Text>
          )}
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.pageTitle}>New List</Text>
        <Text style={styles.pageSubtitle}>Create your curated collection</Text>

        <Text style={styles.label}>LIST NAME</Text>
        <TextInput
          style={styles.nameInput}
          value={listName}
          onChangeText={(t) => {
            setListName(t)
            setError(null)
          }}
          placeholder="e.g. Best Date Spots"
          placeholderTextColor="#d4d4d8"
          maxLength={100}
        />

        {selectedVenues.length > 0 && (
          <View style={styles.block}>
            <Text style={styles.label}>YOUR LIST ({selectedVenues.length})</Text>
            {selectedVenues.map((v) => (
              <View key={v.venue_id} style={styles.yourRow}>
                <View style={styles.yourThumb}>
                  {v.primary_photo_url ? (
                    <Image source={{ uri: v.primary_photo_url }} style={styles.yourThumbImg} />
                  ) : (
                    <View style={styles.yourThumbPh} />
                  )}
                </View>
                <View style={styles.yourBody}>
                  <Text style={styles.yourName} numberOfLines={1}>
                    {v.name}
                  </Text>
                  <Text style={styles.yourMeta}>{neighborhoodLabel(v)}</Text>
                </View>
                <Pressable onPress={() => handleRemove(v.venue_id)} hitSlop={8}>
                  <Text style={styles.removeIcon}>🗑</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.label}>ADD PLACES</Text>
        <View style={styles.searchWrap}>
          <Search size={18} color="#9f9fa9" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search venues..."
            placeholderTextColor="#9f9fa9"
          />
        </View>

        {selectedVenues.length === 0 && !searchQuery.trim() ? (
          <Text style={styles.hint}>Search to add venues to your list</Text>
        ) : null}

        {searching ? (
          <Text style={styles.muted}>Searching...</Text>
        ) : (
          searchResults.map((v) => {
            const vid = nid(v.venue_id)
            const added = selectedIds.has(vid)
            return (
              <View key={v.venue_id} style={styles.resultRow}>
                <View style={styles.resultThumb}>
                  {v.primary_photo_url ? (
                    <Image source={{ uri: v.primary_photo_url }} style={styles.resultThumbImg} />
                  ) : (
                    <View style={styles.resultThumbPh} />
                  )}
                </View>
                <View style={styles.resultBody}>
                  <Text style={styles.resultName} numberOfLines={2}>
                    {v.name || 'Venue'}
                  </Text>
                  <Text style={styles.resultMeta}>{neighborhoodLabel(v)}</Text>
                </View>
                <Pressable
                  onPress={() => handleAdd(v)}
                  disabled={added}
                  style={[styles.addBtn, added && styles.addBtnAdded]}
                >
                  <Text style={[styles.addBtnText, added && styles.addBtnTextAdded]}>
                    {added ? 'Added' : '+ Add'}
                  </Text>
                </Pressable>
              </View>
            )
          })
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.backgroundCanvas },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  topBtn: { padding: spacing.xs },
  topBtnText: { fontSize: 28, color: colors.textPrimary, lineHeight: 32 },
  saveBtn: {
    backgroundColor: colors.textPrimary,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: { opacity: 0.35 },
  saveBtnText: {
    color: '#fff',
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
    letterSpacing: 1.2,
  },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.lg, paddingBottom: spacing['3xl'] },
  pageTitle: {
    fontFamily: fontFamilies.fraunces,
    fontSize: fontSizes['3xl'],
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  pageSubtitle: {
    fontFamily: fontFamilies.frauncesItalic,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    marginBottom: spacing.xl,
  },
  label: {
    fontSize: 10,
    fontWeight: fontWeights.bold,
    letterSpacing: 1,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  nameInput: {
    fontFamily: fontFamilies.fraunces,
    fontSize: fontSizes['2xl'],
    color: colors.textPrimary,
    borderBottomWidth: 1,
    borderBottomColor: '#d4d4d8',
    paddingBottom: spacing.sm,
    marginBottom: spacing.xl,
  },
  block: { marginBottom: spacing.xl },
  yourRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    backgroundColor: colors.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  yourThumb: { width: 56, height: 56, borderWidth: 1, borderColor: colors.borderLight, overflow: 'hidden' },
  yourThumbImg: { width: '100%', height: '100%' },
  yourThumbPh: { flex: 1, backgroundColor: colors.surface },
  yourBody: { flex: 1, minWidth: 0 },
  yourName: { fontFamily: fontFamilies.fraunces, fontSize: fontSizes.base, color: colors.textPrimary },
  yourMeta: { fontSize: 10, fontWeight: fontWeights.bold, letterSpacing: 0.6, color: colors.textMuted },
  removeIcon: { fontSize: 16, opacity: 0.55 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.backgroundElevated,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.md,
  },
  searchIcon: { marginRight: spacing.xs },
  searchInput: { flex: 1, height: 46, fontSize: fontSizes.sm, color: colors.textPrimary },
  hint: {
    textAlign: 'center',
    fontStyle: 'italic',
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    marginBottom: spacing.md,
  },
  muted: { color: colors.textMuted, marginBottom: spacing.sm },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  resultThumb: { width: 64, height: 64, borderWidth: 1, borderColor: colors.borderLight, overflow: 'hidden' },
  resultThumbImg: { width: '100%', height: '100%' },
  resultThumbPh: { flex: 1, backgroundColor: colors.surface },
  resultBody: { flex: 1, minWidth: 0 },
  resultName: { fontFamily: fontFamilies.fraunces, fontSize: fontSizes.lg, color: colors.textPrimary },
  resultMeta: { fontSize: 10, fontWeight: fontWeights.bold, letterSpacing: 0.6, color: colors.textMuted, marginTop: 2 },
  addBtn: {
    backgroundColor: colors.textPrimary,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    minWidth: 84,
    alignItems: 'center',
  },
  addBtnAdded: { backgroundColor: '#f4f4f5' },
  addBtnText: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
    letterSpacing: 0.6,
    color: '#fff',
  },
  addBtnTextAdded: { color: '#9f9fa9' },
  error: { color: colors.error, marginTop: spacing.md, fontSize: fontSizes.sm },
})
