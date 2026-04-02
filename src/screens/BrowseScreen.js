import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Pressable,
  FlatList,
  ActivityIndicator,
  Keyboard,
  Image,
  RefreshControl,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Search, List, Map as MapIcon } from 'lucide-react-native'
import MapView, { Marker } from 'react-native-maps'
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
      latitude: pickCoord(details.latitude, r.latitude),
      longitude: pickCoord(details.longitude, r.longitude),
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

function pickCoord(...vals) {
  for (const v of vals) {
    if (v == null || v === '') continue
    const n = Number(v)
    if (!Number.isNaN(n) && Number.isFinite(n)) return n
  }
  return null
}

const CHICAGO_CENTER = { latitude: 41.8781, longitude: -87.6298 }

function regionForVenueMap(venues) {
  const withCoords = (venues || []).filter(
    (v) => pickCoord(v.latitude) != null && pickCoord(v.longitude) != null
  )
  if (withCoords.length === 0) {
    return {
      ...CHICAGO_CENTER,
      latitudeDelta: 0.12,
      longitudeDelta: 0.12,
    }
  }
  if (withCoords.length === 1) {
    const v = withCoords[0]
    return {
      latitude: pickCoord(v.latitude),
      longitude: pickCoord(v.longitude),
      latitudeDelta: 0.04,
      longitudeDelta: 0.04,
    }
  }
  const lats = withCoords.map((v) => pickCoord(v.latitude))
  const lngs = withCoords.map((v) => pickCoord(v.longitude))
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs)
  const maxLng = Math.max(...lngs)
  const midLat = (minLat + maxLat) / 2
  const midLng = (minLng + maxLng) / 2
  const latDelta = Math.max((maxLat - minLat) * 1.5, 0.03)
  const lngDelta = Math.max((maxLng - minLng) * 1.5, 0.03)
  return {
    latitude: midLat,
    longitude: midLng,
    latitudeDelta: latDelta,
    longitudeDelta: lngDelta,
  }
}

const SEARCH_PLACEHOLDER = "Try 'best date night' or 'cozy cafe'..."

export default function BrowseScreen() {
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const searchInputRef = useRef(null)

  const [searchFocused, setSearchFocused] = useState(false)
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
  const [searchResultsTab, setSearchResultsTab] = useState('list')

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
    setSearchResultsTab('list')
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
        const raw = supabaseData || []
        const ids = raw.map((v) => v.venue_id).filter(Boolean)
        const { data: fullRows } = await fetchVenuesByIds(ids)
        const byId = new Map((fullRows || []).map((v) => [Number(v.venue_id), v]))
        setVenues(
          raw.map((v) => {
            const d = byId.get(Number(v.venue_id))
            return {
              ...v,
              latitude: pickCoord(d?.latitude, v.latitude),
              longitude: pickCoord(d?.longitude, v.longitude),
            }
          })
        )
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

  const openSearchMode = () => {
    setSearchFocused(true)
    setTimeout(() => searchInputRef.current?.focus(), 50)
  }

  const exitSearchMode = () => {
    setSearchFocused(false)
    setSearchQuery('')
    setHasSearched(false)
    setVenues([])
    setError(null)
    setSearchResultsTab('list')
    Keyboard.dismiss()
  }

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

  const renderSearchCompactRow = (venue) => {
    const { primary: tagPrimary, secondary: tagSecondary } = formatTagPair(venue)
    return (
      <TouchableOpacity
        style={styles.searchCompactRow}
        onPress={() => handleVenuePress(venue)}
        activeOpacity={0.85}
      >
        <View style={styles.searchCompactImgWrap}>
          {venue.primary_photo_url ? (
            <Image source={{ uri: venue.primary_photo_url }} style={styles.searchCompactImg} />
          ) : (
            <View style={[styles.searchCompactImg, styles.searchCompactImgPh]} />
          )}
        </View>
        <View style={styles.searchCompactMid}>
          <Text style={styles.searchCompactName} numberOfLines={2} ellipsizeMode="tail">
            {venue.name || 'Unknown'}
          </Text>
          {venue.neighborhood_name ? (
            <Text style={styles.searchCompactHood} numberOfLines={1} ellipsizeMode="tail">
              {String(venue.neighborhood_name)}
            </Text>
          ) : null}
          <View style={styles.searchCompactTags}>
            <Text style={styles.cardTag} numberOfLines={1}>
              {tagPrimary.toUpperCase()}
            </Text>
            <Text style={styles.cardTag} numberOfLines={1}>
              {tagSecondary.toUpperCase()}
            </Text>
          </View>
        </View>
        <View style={styles.searchCompactBadgeCol}>
          <View style={styles.ratingBadge}>
            <Text style={styles.ratingBadgeText}>{formatRating10(venue)}</Text>
          </View>
        </View>
      </TouchableOpacity>
    )
  }

  const renderSearchVenue = ({ item }) => <View style={styles.cardRowOuter}>{renderSearchCompactRow(item)}</View>

  const venuesWithMapCoords = useMemo(
    () => venues.filter((v) => pickCoord(v.latitude) != null && pickCoord(v.longitude) != null),
    [venues]
  )
  const mapRegion = useMemo(() => regionForVenueMap(venues), [venues])
  const mapViewKey = useMemo(() => venues.map((v) => String(v.venue_id)).join(','), [venues])

  const showSearchResults = searchFocused && hasSearched

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.headerBlock}>
        <Text style={styles.cityTitle}>{CITY_TITLE}</Text>

        {searchFocused ? (
          <View style={styles.searchFocusedRow}>
            <View style={styles.searchFocusedInputShell}>
              <View style={styles.searchIconSlot}>
                <Search size={18} color={colors.borderInput} strokeWidth={2} />
              </View>
              <TextInput
                ref={searchInputRef}
                style={styles.searchField}
                placeholder={SEARCH_PLACEHOLDER}
                placeholderTextColor={colors.textTag}
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={handleSubmit}
                returnKeyType="search"
                editable={!loading}
                autoCorrect={false}
              />
            </View>
            <TouchableOpacity onPress={exitSearchMode} style={styles.cancelBtn} hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Pressable
            onPress={openSearchMode}
            style={({ pressed }) => [styles.searchIdlePressable, pressed && styles.searchIdlePressed]}
            accessibilityRole="search"
            accessibilityLabel="Search venues"
          >
            <View style={styles.searchIconSlot}>
              <Search size={18} color={colors.borderInput} strokeWidth={2} />
            </View>
            <Text style={styles.searchIdlePlaceholder} numberOfLines={1}>
              {SEARCH_PLACEHOLDER}
            </Text>
          </Pressable>
        )}
      </View>

      {searchFocused ? (
        <View style={styles.searchBody}>
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={colors.browseAccent} />
              <Text style={styles.loadingText}>Searching...</Text>
            </View>
          ) : showSearchResults ? (
            venues.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>No venues found. Try different keywords.</Text>
              </View>
            ) : (
              <View style={styles.searchResultsWrap}>
                <View style={styles.segmentOuter}>
                  <View style={styles.segmentTrack}>
                    <TouchableOpacity
                      style={[styles.segSide, searchResultsTab === 'list' ? styles.segSideOn : styles.segSideOff]}
                      onPress={() => setSearchResultsTab('list')}
                      activeOpacity={0.85}
                    >
                      <List
                        size={14}
                        color={searchResultsTab === 'list' ? colors.textOnDark : colors.textSecondary}
                        strokeWidth={2}
                      />
                      <Text style={[styles.segLabel, searchResultsTab === 'list' ? styles.segLabelOn : styles.segLabelOff]}>List</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.segSide, styles.segSideRight, searchResultsTab === 'map' ? styles.segSideOn : styles.segSideOff]}
                      onPress={() => setSearchResultsTab('map')}
                      activeOpacity={0.85}
                    >
                      <Map
                        size={14}
                        color={searchResultsTab === 'map' ? colors.textOnDark : colors.textSecondary}
                        strokeWidth={2}
                      />
                      <Text style={[styles.segLabel, searchResultsTab === 'map' ? styles.segLabelOn : styles.segLabelOff]}>Map</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <Text style={styles.resultsCountText} accessibilityRole="header">
                  {venues.length} {venues.length === 1 ? 'Result' : 'Results'}
                </Text>

                {searchResultsTab === 'list' ? (
                  <FlatList
                    style={styles.flexList}
                    data={venues}
                    keyExtractor={(item) => String(item.venue_id)}
                    renderItem={renderSearchVenue}
                    contentContainerStyle={styles.searchListContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                  />
                ) : (
                  <View style={styles.mapWrap}>
                    {venuesWithMapCoords.length === 0 ? (
                      <View style={styles.mapEmpty}>
                        <Text style={styles.mapEmptyText}>No location data for these results. Try another search.</Text>
                      </View>
                    ) : (
                      <MapView
                        key={mapViewKey}
                        style={styles.map}
                        initialRegion={mapRegion}
                        showsPointsOfInterest={false}
                      >
                        {venuesWithMapCoords.map((v) => {
                          const lat = pickCoord(v.latitude)
                          const lng = pickCoord(v.longitude)
                          return (
                            <Marker
                              key={String(v.venue_id)}
                              coordinate={{ latitude: lat, longitude: lng }}
                              title={v.name || 'Venue'}
                              description={v.neighborhood_name ? String(v.neighborhood_name) : undefined}
                              onCalloutPress={() => handleVenuePress(v)}
                              onPress={() => handleVenuePress(v)}
                            />
                          )
                        })}
                      </MapView>
                    )}
                  </View>
                )}
              </View>
            )
          ) : (
            <View style={styles.searchHintBox}>
              <Text style={styles.searchHintText}>Search by venue name, neighborhood, or vibe.</Text>
            </View>
          )}
        </View>
      ) : (
        <>
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
  /** Fills space below header when search mode is active */
  searchBody: {
    flex: 1,
  },
  searchFocusedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  searchFocusedInputShell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1.33,
    borderBottomColor: colors.borderSearchFocused,
    paddingBottom: 12,
    minHeight: 45.33,
    paddingRight: spacing.base,
  },
  cancelBtn: {
    justifyContent: 'center',
    paddingLeft: spacing.sm,
    marginBottom: 2,
  },
  cancelText: {
    fontSize: fontSizes.sm,
    fontFamily: fontFamilies.interMedium,
    fontWeight: fontWeights.medium,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  searchIdlePressable: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1.33,
    borderBottomColor: colors.borderInput,
    paddingBottom: 12,
    minHeight: 45.33,
  },
  searchIdlePressed: {
    opacity: 0.7,
  },
  searchIdlePlaceholder: {
    flex: 1,
    fontSize: fontSizes.sm,
    fontFamily: fontFamilies.interMedium,
    fontWeight: fontWeights.medium,
    color: colors.textTag,
  },
  searchIconSlot: {
    width: 18,
    marginRight: 14,
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
  searchHintBox: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing['2xl'],
    alignItems: 'center',
  },
  searchHintText: {
    fontSize: fontSizes.sm,
    fontFamily: fontFamilies.inter,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  searchResultsWrap: {
    flex: 1,
  },
  segmentOuter: {
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  /** Figma 56:182 — ~203×38.7, border #d4d4d8 */
  segmentTrack: {
    flexDirection: 'row',
    borderWidth: 1.33,
    borderColor: colors.borderInput,
    width: 203,
    minHeight: 38.67,
    padding: 1.33,
    backgroundColor: colors.backgroundElevated,
  },
  segSide: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 36,
    gap: 5,
  },
  segSideRight: {
    borderLeftWidth: 1.33,
    borderLeftColor: colors.borderInput,
  },
  segSideOn: {
    backgroundColor: colors.backgroundDark,
  },
  segSideOff: {
    backgroundColor: colors.backgroundElevated,
  },
  segLabel: {
    fontSize: 12,
    fontFamily: fontFamilies.interBold,
    fontWeight: fontWeights.bold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  segLabelOn: {
    color: colors.textOnDark,
  },
  segLabelOff: {
    color: colors.textSecondary,
  },
  resultsCountText: {
    fontSize: fontSizes.sm,
    fontFamily: fontFamilies.interMedium,
    fontWeight: fontWeights.medium,
    color: colors.textPrimary,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  searchListContent: { paddingHorizontal: spacing.xl, paddingBottom: spacing['3xl'] },
  mapWrap: {
    flex: 1,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.lg,
    minHeight: 320,
    borderWidth: 1.33,
    borderColor: colors.borderInput,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  mapEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    minHeight: 280,
  },
  mapEmptyText: {
    fontSize: fontSizes.sm,
    fontFamily: fontFamilies.inter,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  searchCompactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.base,
    minHeight: 80,
  },
  searchCompactImgWrap: {
    width: 80,
    height: 80,
    flexShrink: 0,
    backgroundColor: colors.backgroundMuted,
    overflow: 'hidden',
  },
  searchCompactImg: {
    width: 80,
    height: 80,
  },
  searchCompactImgPh: {
    backgroundColor: colors.surface,
  },
  searchCompactMid: {
    flex: 1,
    marginLeft: spacing.base,
    justifyContent: 'center',
    minHeight: 80,
    paddingRight: spacing.sm,
  },
  searchCompactName: {
    fontSize: fontSizes.lg,
    fontFamily: fontFamilies.frauncesRegular,
    fontWeight: fontWeights.normal,
    color: colors.textPrimary,
    lineHeight: 22.5,
  },
  searchCompactHood: {
    fontSize: fontSizes.sm,
    fontFamily: fontFamilies.frauncesItalic,
    fontStyle: 'italic',
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  searchCompactTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: 6,
    alignItems: 'center',
  },
  searchCompactBadgeCol: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  flexList: { flex: 1 },
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
