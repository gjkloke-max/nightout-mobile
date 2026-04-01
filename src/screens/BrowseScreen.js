import { useState, useCallback, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Keyboard,
  Image,
  RefreshControl,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { Search } from 'lucide-react-native'
import { colors, fontSizes, fontWeights, spacing, borderRadius, iconSizes, fontFamilies } from '../theme'
import { bm25Search } from '../lib/searchApi'
import { fetchVenuesByIds, searchVenuesByName } from '../lib/venueService'
import { getTrendingVenues } from '../services/trendingVenues'

const CITY_TITLE = 'Chicago'

const TABS = [
  { id: 'trending', label: 'Trending' },
  { id: 'forYou', label: 'For You' },
  { id: 'map', label: 'Map' },
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

function getVenueTypeName(venue) {
  const vt = Array.isArray(venue?.venue_type) ? venue.venue_type[0] : venue?.venue_type
  return vt?.venue_type_name || ''
}

function formatTags(venue) {
  const typeName = getVenueTypeName(venue)
  const primary = typeName ? typeName.toUpperCase() : 'VENUE'
  return `${primary} · SPOT`
}

function formatRating10(venue) {
  const r = venue?.rating10
  if (r == null || Number.isNaN(Number(r))) return '—'
  return Number(r).toFixed(1)
}

export default function BrowseScreen() {
  const navigation = useNavigation()

  const [mainTab, setMainTab] = useState('trending')
  const [searchQuery, setSearchQuery] = useState('')
  const [venues, setVenues] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [hasSearched, setHasSearched] = useState(false)

  const [trendingItems, setTrendingItems] = useState([])
  const [trendingLoading, setTrendingLoading] = useState(false)
  const [trendingError, setTrendingError] = useState(null)
  const [trendingRefreshing, setTrendingRefreshing] = useState(false)

  const loadTrending = useCallback(async () => {
    setTrendingLoading(true)
    setTrendingError(null)
    try {
      const data = await getTrendingVenues(15)
      setTrendingItems(data)
    } catch (e) {
      setTrendingError(e?.message || 'Failed to load trending venues')
      setTrendingItems([])
    } finally {
      setTrendingLoading(false)
      setTrendingRefreshing(false)
    }
  }, [])

  useEffect(() => {
    if (mainTab !== 'trending') return
    loadTrending()
  }, [mainTab, loadTrending])

  const onTrendingRefresh = useCallback(() => {
    setTrendingRefreshing(true)
    loadTrending()
  }, [loadTrending])

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
      const { data: apiRows, error: apiErr } = await bm25Search({
        queryText: q,
        matchCount: 25,
      })

      if (apiErr || !apiRows?.length) {
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

  const handleVenuePress = (venue) => {
    const root = navigation.getParent()?.getParent?.()
    root?.navigate?.('VenueProfile', { venueId: venue.venue_id })
  }

  const onTabPress = (id) => {
    setMainTab(id)
    setHasSearched(false)
    setVenues([])
    setError(null)
    setSearchQuery('')
  }

  const renderCompactRow = (venue) => (
    <TouchableOpacity
      style={styles.hotRow}
      onPress={() => handleVenuePress(venue)}
      activeOpacity={0.85}
    >
      <View style={styles.hotThumbWrap}>
        {venue.primary_photo_url ? (
          <Image source={{ uri: venue.primary_photo_url }} style={styles.hotThumb} />
        ) : (
          <View style={[styles.hotThumb, styles.hotThumbPh]} />
        )}
      </View>
      <View style={styles.hotMid}>
        <Text style={styles.hotName} numberOfLines={2} ellipsizeMode="tail">
          {venue.name || 'Unknown'}
        </Text>
        {venue.neighborhood_name ? (
          <Text style={styles.hotHood} numberOfLines={1} ellipsizeMode="tail">
            {String(venue.neighborhood_name).toUpperCase()}
          </Text>
        ) : null}
        <Text style={styles.hotTags} numberOfLines={1}>
          {formatTags(venue)}
        </Text>
      </View>
      <View style={styles.hotBadge}>
        <Text style={styles.hotBadgeText}>{formatRating10(venue)}</Text>
      </View>
    </TouchableOpacity>
  )

  const renderTrendingItem = ({ item }) => renderCompactRow(item.venue)

  const renderSearchVenue = ({ item }) => <View style={styles.rowWrap}>{renderCompactRow(item)}</View>

  const showSearchResults = hasSearched

  return (
    <View style={styles.container}>
      <Text style={styles.cityTitle}>{CITY_TITLE}</Text>

      <View style={styles.searchWrap}>
        <Search size={iconSizes.inline} color={colors.textMuted} strokeWidth={2} style={styles.searchLeadingIcon} />
        <TextInput
          style={styles.searchField}
          placeholder="Try 'best date night' or 'cozy cocktails'..."
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSubmit}
          returnKeyType="search"
          editable={!loading}
        />
      </View>

      <View style={styles.tabRow}>
        {TABS.map((t) => {
          const active = mainTab === t.id
          return (
            <TouchableOpacity
              key={t.id}
              style={[styles.tabBtn, active && styles.tabBtnActive]}
              onPress={() => onTabPress(t.id)}
              activeOpacity={0.85}
            >
              <Text style={[styles.tabBtnText, active && styles.tabBtnTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          )
        })}
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {showSearchResults ? (
        <>
          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={colors.browseAccent} />
              <Text style={styles.loadingText}>Searching...</Text>
            </View>
          ) : venues.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>No venues found. Try different keywords.</Text>
            </View>
          ) : (
            <>
              <View style={styles.sectionRow}>
                <Text style={styles.sectionTitle}>Results</Text>
                <View style={styles.sectionLine} />
              </View>
              <FlatList
                style={styles.flexList}
                data={venues}
                keyExtractor={(item) => String(item.venue_id)}
                renderItem={renderSearchVenue}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
              />
            </>
          )}
        </>
      ) : (
        <>
          {mainTab === 'trending' && (
            <>
              {trendingError ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{trendingError}</Text>
                </View>
              ) : null}
              {trendingLoading && trendingItems.length === 0 ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator size="large" color={colors.browseAccent} />
                  <Text style={styles.loadingText}>Loading...</Text>
                </View>
              ) : !trendingLoading && trendingItems.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyText}>
                    No trending data yet. Run the scraper to populate mentions.
                  </Text>
                </View>
              ) : (
                <>
                  <View style={styles.sectionRow}>
                    <Text style={styles.sectionTitle}>Hot right now</Text>
                    <View style={styles.sectionLine} />
                  </View>
                  <FlatList
                    style={styles.flexList}
                    data={trendingItems}
                    keyExtractor={(item) => String(item.venue.venue_id)}
                    renderItem={renderTrendingItem}
                    ListFooterComponent={<View style={styles.listFooterPad} />}
                    contentContainerStyle={styles.trendingListContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                      <RefreshControl
                        refreshing={trendingRefreshing}
                        onRefresh={onTrendingRefresh}
                        tintColor={colors.browseAccent}
                      />
                    }
                  />
                </>
              )}
            </>
          )}

          {mainTab === 'forYou' && (
            <View style={styles.placeholderBox}>
              <Text style={styles.placeholderTitle}>For you</Text>
              <Text style={styles.placeholderBody}>
                Personalized picks based on your taste and history will appear here.
              </Text>
            </View>
          )}

          {mainTab === 'map' && (
            <View style={styles.placeholderBox}>
              <Text style={styles.placeholderTitle}>Map</Text>
              <Text style={styles.placeholderBody}>Explore venues on a map — coming soon.</Text>
            </View>
          )}
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundCanvas },
  cityTitle: {
    fontSize: fontSizes['3xl'],
    fontFamily: fontFamilies.fraunces,
    color: colors.textPrimary,
    letterSpacing: -0.5,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.base,
    marginBottom: spacing.lg,
    backgroundColor: colors.backgroundMuted,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    minHeight: 48,
  },
  searchLeadingIcon: { marginRight: spacing.sm },
  searchField: {
    flex: 1,
    paddingVertical: 12,
    fontSize: fontSizes.sm,
    fontFamily: fontFamilies.inter,
    color: colors.textPrimary,
  },
  tabRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
    marginBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingBottom: spacing.sm,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundElevated,
  },
  tabBtnActive: {
    backgroundColor: colors.backgroundDark,
    borderColor: colors.backgroundDark,
  },
  tabBtnText: {
    fontSize: 10,
    fontFamily: fontFamilies.interSemiBold,
    fontWeight: fontWeights.semibold,
    letterSpacing: 0.6,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  tabBtnTextActive: {
    color: colors.textOnDark,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.base,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: 10,
    fontFamily: fontFamilies.interBold,
    fontWeight: fontWeights.bold,
    letterSpacing: 0.8,
    color: colors.textPrimary,
    textTransform: 'uppercase',
  },
  sectionLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: spacing.sm,
    minHeight: 1,
  },
  errorBox: {
    marginHorizontal: spacing.base,
    marginBottom: spacing.md,
    padding: spacing.base,
    backgroundColor: 'rgba(184, 84, 80, 0.12)',
    borderRadius: borderRadius.md,
  },
  errorText: { fontSize: fontSizes.sm, color: colors.error, fontFamily: fontFamilies.inter },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    fontFamily: fontFamilies.inter,
  },
  emptyBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emptyText: {
    fontSize: fontSizes.base,
    color: colors.textMuted,
    fontFamily: fontFamilies.inter,
    textAlign: 'center',
  },
  flexList: { flex: 1 },
  listContent: { paddingHorizontal: spacing.base, paddingBottom: spacing['3xl'] },
  trendingListContent: { paddingHorizontal: spacing.base, paddingBottom: spacing['3xl'] },
  rowWrap: { marginBottom: 0 },
  hotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  hotThumbWrap: { flexShrink: 0 },
  hotThumb: {
    width: 56,
    height: 56,
    borderRadius: 8,
  },
  hotThumbPh: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  hotMid: { flex: 1, minWidth: 0 },
  hotName: {
    fontSize: fontSizes.lg,
    fontFamily: fontFamilies.frauncesSemiBold,
    fontWeight: fontWeights.semibold,
    color: colors.textPrimary,
  },
  hotHood: {
    fontSize: fontSizes.sm,
    fontFamily: fontFamilies.frauncesItalic,
    fontStyle: 'italic',
    color: colors.textSecondary,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  hotTags: {
    fontSize: 10,
    fontFamily: fontFamilies.interSemiBold,
    fontWeight: fontWeights.semibold,
    letterSpacing: 0.4,
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  hotBadge: {
    minWidth: 40,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: colors.browseAccent,
    borderWidth: 1,
    borderColor: colors.browseAccentBorder,
    alignItems: 'center',
  },
  hotBadgeText: {
    fontSize: fontSizes.sm,
    fontFamily: fontFamilies.interBold,
    fontWeight: fontWeights.bold,
    color: colors.textOnDark,
  },
  listFooterPad: { height: spacing.lg },
  placeholderBox: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing['2xl'],
    alignItems: 'center',
  },
  placeholderTitle: {
    fontSize: fontSizes.xl,
    fontFamily: fontFamilies.frauncesSemiBold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  placeholderBody: {
    fontSize: fontSizes.base,
    fontFamily: fontFamilies.inter,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
})
