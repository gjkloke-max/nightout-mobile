import { useState, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Keyboard,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { Search } from 'lucide-react-native'
import { colors, fontSizes, fontWeights, spacing, borderRadius, iconSizes } from '../theme'
import { bm25Search } from '../lib/searchApi'
import { fetchVenuesByIds, searchVenuesByName } from '../lib/venueService'
import VenueCard from '../components/VenueCard'

const DISCOVERY_CHIPS = [
  "What's your vibe?",
  'Best date night',
  'Good gluten-free options',
  'Cozy cocktails',
  'Best brunch nearby',
  'Worth the hype',
]

function dedupeByVenueId(rows) {
  const seen = new Set()
  return (rows || []).filter((r) => {
    const id = r?.venue_id
    if (!id || seen.has(id)) return false
    seen.add(id)
    return true
  })
}

function venueIdKey(id) {
  const n = parseInt(String(id), 10)
  return Number.isNaN(n) ? null : n
}

function mergeVenueDetails(apiRows, supabaseVenues) {
  const byId = new Map()
  ;(supabaseVenues || []).forEach((v) => {
    const k = venueIdKey(v.venue_id)
    if (k != null) byId.set(k, v)
  })
  return (apiRows || []).map((r) => {
    const k = venueIdKey(r.venue_id)
    const details = (k != null ? byId.get(k) : null) || {}
    return {
      venue_id: r.venue_id,
      name: r.name || details.name || 'Unknown',
      primary_photo_url: details.primary_photo_url ?? r.primary_photo_url ?? null,
      neighborhood_name: r.neighborhood_name ?? details.neighborhood_name,
      rating10: r.rating10 ?? details.rating10,
      venue_type: details.venue_type,
      state: details.state,
      city: details.city,
    }
  })
}

export default function BrowseScreen() {
  const navigation = useNavigation()
  const [searchQuery, setSearchQuery] = useState('')
  const [venues, setVenues] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [hasSearched, setHasSearched] = useState(false)

  const runSearch = useCallback(async (query) => {
    const q = (query || '').trim()
    if (!q) {
      setVenues([])
      setError(null)
      setHasSearched(false)
      return
    }

    setLoading(true)
    setError(null)
    setHasSearched(true)
    Keyboard.dismiss()

    try {
      // Try Search API first (BM25 on reviews/venue_search_data)
      const { data: apiRows, error: apiErr } = await bm25Search({
        queryText: q,
        matchCount: 25,
      })

      if (apiErr || !apiRows?.length) {
        // Fallback: Supabase venue name search
        const { data: supabaseData, error: supErr } = await searchVenuesByName(q, 25)
        if (supErr) {
          setError(apiErr?.message || supErr?.message || 'Search failed')
          setVenues([])
          return
        }
        setVenues(supabaseData || [])
        return
      }

      const deduped = dedupeByVenueId(apiRows)
      const venueIds = deduped.map((r) => r.venue_id)
      const { data: supabaseVenues } = await fetchVenuesByIds(venueIds)
      const merged = mergeVenueDetails(deduped, supabaseVenues)
      setVenues(merged)
    } catch (err) {
      setError(err?.message || 'Search failed')
      setVenues([])
    } finally {
      setLoading(false)
    }
  }, [])

  const handleSubmit = () => runSearch(searchQuery)

  const handleChipPress = (chip) => {
    setSearchQuery(chip)
    runSearch(chip)
  }

  const handleVenuePress = (venue) => {
    const root = navigation.getParent()?.getParent?.()
    root?.navigate?.('VenueProfile', { venueId: venue.venue_id })
  }

  const renderVenue = ({ item }) => (
    <VenueCard venue={item} onPress={() => handleVenuePress(item)} />
  )

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <View style={styles.searchInputWrapper}>
          <Search size={iconSizes.inline} color={colors.textMuted} strokeWidth={2} style={styles.searchIcon} />
          <TextInput
            style={styles.searchBar}
            placeholder="Search venues, neighborhoods..."
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSubmit}
          returnKeyType="search"
          editable={!loading}
        />
        </View>
        <TouchableOpacity
          style={[styles.searchButton, loading && styles.searchButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading || !searchQuery.trim()}
        >
          <Text style={styles.searchButtonText}>{loading ? '…' : 'Search'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.chipsWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsContent}
        >
          {DISCOVERY_CHIPS.map((chip, i) => (
            <TouchableOpacity
              key={i}
              style={styles.chip}
              onPress={() => handleChipPress(chip)}
              activeOpacity={0.7}
              disabled={loading}
            >
              <Text style={styles.chipText}>{chip}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Searching...</Text>
        </View>
      ) : hasSearched && venues.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>No venues found. Try different keywords.</Text>
        </View>
      ) : !hasSearched ? (
        <View style={styles.emptyBox}>
          <Text style={styles.hintText}>
            Search or tap a chip to discover venues
          </Text>
        </View>
      ) : venues.length > 0 ? (
        <View style={styles.resultsHeader}>
          <Text style={styles.resultsCount}>
            {venues.length} {venues.length === 1 ? 'venue' : 'venues'}
          </Text>
        </View>
      ) : null}

      {!loading && venues.length > 0 ? (
        <FlatList
          data={venues}
          keyExtractor={(item) => String(item.venue_id)}
          renderItem={renderVenue}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  searchRow: {
    flexDirection: 'row',
    padding: spacing.base,
    gap: spacing.sm,
    alignItems: 'center',
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundElevated,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.base,
  },
  searchIcon: { marginRight: spacing.sm },
  searchBar: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    fontSize: fontSizes.base,
    color: colors.textPrimary,
  },
  searchButton: {
    paddingHorizontal: spacing.lg,
    height: 48,
    justifyContent: 'center',
    backgroundColor: colors.accent,
    borderRadius: borderRadius.md,
  },
  searchButtonDisabled: { opacity: 0.6 },
  searchButtonText: {
    fontSize: fontSizes.base,
    fontWeight: fontWeights.semibold,
    color: colors.textOnDark,
  },
  chipsWrapper: { marginBottom: spacing.md },
  chipsContent: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.base,
    paddingVertical: 10,
    backgroundColor: colors.backgroundElevated,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipText: { fontSize: fontSizes.sm, color: colors.textPrimary, fontWeight: fontWeights.medium },
  errorBox: {
    marginHorizontal: spacing.base,
    marginBottom: spacing.md,
    padding: spacing.base,
    backgroundColor: 'rgba(184, 84, 80, 0.12)',
    borderRadius: borderRadius.md,
  },
  errorText: { fontSize: fontSizes.sm, color: colors.error },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  loadingText: { marginTop: spacing.md, fontSize: fontSizes.sm, color: colors.textMuted },
  emptyBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emptyText: { fontSize: fontSizes.base, color: colors.textMuted },
  hintText: { fontSize: fontSizes.base, color: colors.textMuted, textAlign: 'center' },
  resultsHeader: { paddingHorizontal: spacing.base, paddingBottom: spacing.sm },
  resultsCount: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    fontWeight: fontWeights.medium,
  },
  listContent: { padding: spacing.base, paddingBottom: spacing['3xl'] },
})
