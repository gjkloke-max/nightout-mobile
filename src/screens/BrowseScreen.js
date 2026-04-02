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
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Search } from 'lucide-react-native'
import { colors, fontSizes, fontWeights, spacing, borderRadius, iconSizes, fontFamilies } from '../theme'
import { bm25Search } from '../lib/searchApi'
import { fetchVenuesByIds, searchVenuesByName } from '../lib/venueService'
import { getTrendingVenues } from '../services/trendingVenues'

const CITY_TITLE = 'Chicago'

const TABS = [
  { id: 'trending', label: 'Trending' },
  { id: 'forYou', label: 'For You' },
  { id: 'popularLists', label: 'Popular Lists' },
]

/** Figma Browse — secondary tag when we only have venue_type (no editorial vibes) */
const VIBE_TAGS = ['Date Night', 'Cozy', 'Community', 'Local spot']

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
  return (vt?.venue_type_name || '').trim()
}

function formatTagPair(venue) {
  const typeName = getVenueTypeName(venue)
  const primary = typeName ? typeName : 'Venue'
  const id = parseInt(String(venue?.venue_id || '0'), 10) || 0
  const secondary = VIBE_TAGS[Math.abs(id) % VIBE_TAGS.length]
  return { primary, secondary }
}

function formatRating10(venue) {
  const r = venue?.rating10
  if (r == null || Number.isNaN(Number(r))) return '—'
  return Number(r).toFixed(1)
}

export default function BrowseScreen() {
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()

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

  const renderVenueCard = (venue) => {
    const { primary: tagPrimary, secondary: tagSecondary } = formatTagPair(venue)
    return (
      <TouchableOpacity
        style={styles.cardRow}
        onPress={() => handleVenuePress(venue)}
        activeOpacity={0.85}
      >
        <View style={styles.cardImageWrap}>
          {venue.primary_photo_url ? (
            <Image source={{ uri: venue.primary_photo_url }} style={styles.cardImage} />
          ) : (
            <View style={[styles.cardImage, styles.cardImagePh]} />
          )}
        </View>
        <View style={styles.cardBody}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardName} numberOfLines={2} ellipsizeMode="tail">
              {venue.name || 'Unknown'}
            </Text>
            <View style={styles.ratingBadge}>
              <Text style={styles.ratingBadgeText}>{formatRating10(venue)}</Text>
            </View>
          </View>
          {venue.neighborhood_name ? (
            <Text style={styles.cardHood} numberOfLines={1} ellipsizeMode="tail">
              {String(venue.neighborhood_name)}
            </Text>
          ) : null}
          <View style={styles.cardTagsRow}>
            <Text style={styles.cardTag} numberOfLines={1}>
              {tagPrimary.toUpperCase()}
            </Text>
            <Text style={styles.cardTag} numberOfLines={1}>
              {tagSecondary.toUpperCase()}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    )
  }

  const renderTrendingItem = ({ item }) => renderVenueCard(item.venue)

  const renderSearchVenue = ({ item }) => <View style={styles.cardRowOuter}>{renderVenueCard(item)}</View>

  const showSearchResults = hasSearched

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.headerBlock}>
        <Text style={styles.cityTitle}>{CITY_TITLE}</Text>

        <View style={styles.searchUnderlineWrap}>
          <View style={styles.searchIconSlot}>
            <Search size={18} color={colors.borderInput} strokeWidth={2} />
          </View>
          <TextInput
            style={styles.searchField}
            placeholder="Try 'best date night' or 'cozy cafe'..."
            placeholderTextColor={colors.textTag}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSubmit}
            returnKeyType="search"
            editable={!loading}
          />
        </View>
      </View>

      <View style={styles.tabBar}>
        {TABS.map((t) => {
          const active = mainTab === t.id
          return (
            <TouchableOpacity
              key={t.id}
              style={[styles.tabBtn, active ? styles.tabBtnActive : styles.tabBtnIdle]}
              onPress={() => onTabPress(t.id)}
              activeOpacity={0.85}
            >
              <Text style={[styles.tabBtnText, active ? styles.tabBtnTextActive : styles.tabBtnTextIdle]}>{t.label}</Text>
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
                    <Text style={styles.sectionTitle}>Hot Right Now</Text>
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

          {mainTab === 'popularLists' && (
            <View style={styles.placeholderBox}>
              <Text style={styles.placeholderTitle}>Popular lists</Text>
              <Text style={styles.placeholderBody}>
                Curated lists from the community will appear here. Save venues to lists from a venue profile to build your own.
              </Text>
            </View>
          )}
        </>
      )}
    </View>
  )
}

const TAB_GAP = 8

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundCanvas },
  headerBlock: {
    paddingHorizontal: spacing.xl,
    paddingTop: 48,
    paddingBottom: spacing.xl,
    gap: spacing.xl,
  },
  cityTitle: {
    fontSize: fontSizes['4xl'],
    fontFamily: fontFamilies.frauncesRegular,
    fontWeight: fontWeights.normal,
    color: colors.textPrimary,
    letterSpacing: -0.5,
    lineHeight: fontSizes['4xl'],
  },
  searchUnderlineWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1.33,
    borderBottomColor: colors.borderInput,
    paddingBottom: 12,
    minHeight: 45.33,
  },
  searchIconSlot: {
    width: 18,
    marginRight: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchField: {
    flex: 1,
    paddingVertical: 0,
    fontSize: fontSizes.sm,
    fontFamily: fontFamilies.interMedium,
    fontWeight: fontWeights.medium,
    color: colors.textPrimary,
  },
  tabBar: {
    flexDirection: 'row',
    gap: TAB_GAP,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1.33,
    borderBottomColor: colors.border,
  },
  tabBtn: {
    flex: 1,
    height: 43.17,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.33,
  },
  tabBtnActive: {
    backgroundColor: colors.backgroundDark,
    borderColor: colors.backgroundDark,
  },
  tabBtnIdle: {
    backgroundColor: colors.backgroundElevated,
    borderColor: colors.borderInput,
  },
  tabBtnText: {
    fontSize: 11,
    fontFamily: fontFamilies.interBold,
    fontWeight: fontWeights.bold,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  tabBtnTextActive: {
    color: colors.textOnTabActive,
  },
  tabBtnTextIdle: {
    color: colors.textSecondary,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: fontFamilies.interBold,
    fontWeight: fontWeights.bold,
    letterSpacing: 1.2,
    color: colors.textPrimary,
    textTransform: 'uppercase',
  },
  sectionLine: {
    width: 48,
    height: 1,
    backgroundColor: colors.borderInput,
  },
  errorBox: {
    marginHorizontal: spacing.xl,
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
  listContent: { paddingHorizontal: spacing.xl, paddingBottom: spacing['3xl'] },
  trendingListContent: { paddingHorizontal: spacing.xl, paddingBottom: spacing['3xl'] },
  cardRowOuter: { marginBottom: 0 },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginBottom: spacing.xl,
    minHeight: 112,
  },
  cardImageWrap: {
    width: 112,
    height: 112,
    flexShrink: 0,
    backgroundColor: colors.backgroundMuted,
    overflow: 'hidden',
  },
  cardImage: {
    width: 112,
    height: 112,
  },
  cardImagePh: {
    backgroundColor: colors.surface,
  },
  cardBody: {
    flex: 1,
    marginLeft: spacing.base,
    justifyContent: 'center',
    minHeight: 112,
    paddingVertical: 2,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  cardName: {
    flex: 1,
    fontSize: fontSizes['2xl'],
    fontFamily: fontFamilies.frauncesRegular,
    fontWeight: fontWeights.normal,
    color: colors.textPrimary,
    lineHeight: fontSizes['2xl'],
  },
  ratingBadge: {
    minWidth: 36,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderWidth: 1.33,
    borderColor: colors.browseAccentBorder,
    backgroundColor: colors.browseAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingBadgeText: {
    fontSize: 11,
    fontFamily: fontFamilies.fraunces,
    fontWeight: fontWeights.bold,
    color: colors.textOnDark,
    letterSpacing: -0.275,
  },
  cardHood: {
    fontSize: fontSizes.sm,
    fontFamily: fontFamilies.frauncesItalic,
    fontStyle: 'italic',
    color: colors.textSecondary,
    marginTop: 4,
    lineHeight: 20,
  },
  cardTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: 8,
    alignItems: 'center',
  },
  cardTag: {
    fontSize: 10,
    fontFamily: fontFamilies.interMedium,
    fontWeight: fontWeights.medium,
    letterSpacing: 0.5,
    color: colors.textTag,
    textTransform: 'uppercase',
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
