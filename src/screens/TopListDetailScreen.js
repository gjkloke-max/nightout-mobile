import { useState, useEffect, useLayoutEffect, useCallback } from 'react'
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Image, Share } from 'react-native'
import { useRoute, useNavigation } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ChevronLeft, MapPin, Share2 } from 'lucide-react-native'
import { getPublishedTopListWithVenues } from '../services/adminTopLists'
import { deriveBrowseTagPair } from '../utils/browseVenueTags'
import { config } from '../lib/config'
import { colors, fontSizes, fontFamilies, spacing, borderRadius } from '../theme'

/** Content height reserved below safe area so the hero sits under the icon row (not under the frosted bar) */
const LIST_HEADER_ROW_HEIGHT = 52

export default function TopListDetailScreen() {
  const route = useRoute()
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const topListId = route?.params?.topListId

  const [list, setList] = useState(null)
  const [loading, setLoading] = useState(true)

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false })
  }, [navigation])

  const loadList = useCallback(async () => {
    setLoading(true)
    const data = await getPublishedTopListWithVenues(topListId)
    setList(data)
    setLoading(false)
  }, [topListId])

  useEffect(() => {
    if (topListId) loadList()
  }, [topListId, loadList])

  const handleVenuePress = (venue) => {
    const vid = venue?.venue_id
    if (!vid) return
    navigation.navigate('VenueProfile', { venueId: vid })
  }

  const handleShare = async () => {
    const path = `/top-lists/${topListId}`
    const url = config.webAppUrl ? `${config.webAppUrl.replace(/\/$/, '')}${path}` : path
    try {
      await Share.share({
        message: list?.title ? `${list.title} — ${url}` : url,
        title: list?.title || 'Top List',
      })
    } catch {
      /* cancelled */
    }
  }

  if (!topListId) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>No list specified</Text>
      </View>
    )
  }

  if (loading && !list) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.browseAccent} />
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

  const venues = list.venues || []
  const heroPhotos = venues.map((v) => v.primary_photo_url).filter(Boolean).slice(0, 3)
  const metaLine = `${venues.length} ${venues.length === 1 ? 'place' : 'places'}`

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + LIST_HEADER_ROW_HEIGHT,
            paddingBottom: insets.bottom + 88,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroWrap}>
          <View style={styles.heroInner}>
            {heroPhotos.length === 0 && <View style={styles.heroEmpty} />}
            {heroPhotos.length === 1 && (
              <Image source={{ uri: heroPhotos[0] }} style={styles.heroOne} resizeMode="cover" />
            )}
            {heroPhotos.length >= 2 && (
              <View style={styles.heroSplit}>
                <Image source={{ uri: heroPhotos[0] }} style={styles.heroMain} resizeMode="cover" />
                <View style={styles.heroStack}>
                  <Image source={{ uri: heroPhotos[1] }} style={styles.heroSmall} resizeMode="cover" />
                  {heroPhotos[2] ? <Image source={{ uri: heroPhotos[2] }} style={styles.heroSmall} resizeMode="cover" /> : null}
                </View>
              </View>
            )}
          </View>
        </View>

        <View style={styles.body}>
          <Text style={styles.title}>{list.title}</Text>
          <Text style={styles.meta}>{metaLine}</Text>
          {list.subtitle ? <Text style={styles.creator}>{list.subtitle}</Text> : null}

          <View style={styles.actions}>
            <Pressable style={styles.shareCircle} onPress={handleShare} accessibilityLabel="Share list">
              <Share2 size={22} color={colors.textPrimary} strokeWidth={1.75} />
            </Pressable>
          </View>

          <Text style={styles.sectionTitle}>Places in this list</Text>

          {!venues.length ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No places yet.</Text>
            </View>
          ) : (
            venues.map((v, index) => {
              const tags = deriveBrowseTagPair(v)
              const rating = v.rating10 != null && v.rating10 !== '' ? Number(v.rating10).toFixed(1) : null
              const neighborhood = (v.neighborhood_name || v.city || '').trim()
              const badgeAlt = index % 2 === 1
              return (
                <View key={v.venue_id} style={styles.card}>
                  <Text style={styles.rank}>{index + 1}</Text>
                  <Pressable onPress={() => handleVenuePress(v)}>
                    {v.primary_photo_url ? (
                      <Image source={{ uri: v.primary_photo_url }} style={styles.thumb} resizeMode="cover" />
                    ) : (
                      <View style={[styles.thumb, styles.thumbPh]} />
                    )}
                  </Pressable>
                  <View style={styles.cardMain}>
                    <Pressable onPress={() => handleVenuePress(v)}>
                      <Text style={styles.cardName} numberOfLines={2}>
                        {v.name || 'Venue'}
                      </Text>
                    </Pressable>
                    <View style={styles.cardRow}>
                      {neighborhood ? (
                        <View style={styles.locRow}>
                          <MapPin size={12} color={colors.textSecondary} strokeWidth={1.5} />
                          <Text style={styles.locText} numberOfLines={1}>
                            {neighborhood}
                          </Text>
                        </View>
                      ) : null}
                      {neighborhood && rating ? <Text style={styles.dot}>•</Text> : null}
                      {rating ? (
                        <View style={[styles.badge, badgeAlt && styles.badgeAlt]}>
                          <Text style={styles.badgeText}>{rating}</Text>
                        </View>
                      ) : null}
                    </View>
                    <View style={styles.tags}>
                      <Text style={styles.tag}>{String(tags.primary || '').toUpperCase()}</Text>
                      {tags.secondary && tags.secondary !== tags.primary ? (
                        <Text style={styles.tag}>{String(tags.secondary || '').toUpperCase()}</Text>
                      ) : null}
                    </View>
                  </View>
                </View>
              )
            })
          )}
        </View>
      </ScrollView>

      {/* Frosted overlay header */}
      <View style={[styles.topBar, { paddingTop: insets.top }]}>
        <Pressable style={styles.iconBtn} onPress={() => navigation.goBack()} accessibilityLabel="Back">
          <ChevronLeft size={24} color={colors.textPrimary} strokeWidth={2} />
        </Pressable>
        <View style={styles.iconBtn} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: 0 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  error: { fontSize: fontSizes.base, color: colors.textMuted, marginBottom: spacing.lg },
  backBtn: { padding: spacing.base },
  backBtnText: { color: colors.link },
  heroWrap: { paddingHorizontal: spacing.lg, paddingTop: 0 },
  heroInner: { marginTop: 0 },
  heroEmpty: {
    height: 200,
    backgroundColor: colors.backgroundMuted,
    borderRadius: borderRadius.lg,
  },
  heroOne: {
    width: '100%',
    height: 240,
    borderRadius: borderRadius.md,
    backgroundColor: colors.backgroundMuted,
  },
  heroSplit: {
    flexDirection: 'row',
    gap: spacing.sm,
    height: 288,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    padding: 9,
    backgroundColor: colors.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroMain: { flex: 1, borderRadius: borderRadius.md, backgroundColor: colors.backgroundMuted },
  heroStack: { width: 112, gap: spacing.sm },
  heroSmall: { flex: 1, borderRadius: borderRadius.md, backgroundColor: colors.backgroundMuted },
  body: { paddingHorizontal: spacing.lg, marginTop: spacing.sm },
  title: {
    fontSize: 30,
    lineHeight: 36,
    fontFamily: fontFamilies.interBold,
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  meta: {
    marginTop: spacing.sm,
    fontSize: fontSizes.sm,
    fontFamily: fontFamilies.inter,
    color: colors.textSecondary,
  },
  creator: {
    marginTop: 6,
    fontSize: fontSizes.sm,
    fontFamily: fontFamilies.inter,
    color: colors.textSecondary,
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.lg },
  shareCircle: {
    width: 56,
    height: 56,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    marginTop: spacing.xl,
    marginBottom: spacing.base,
    fontSize: fontSizes.lg,
    fontFamily: fontFamilies.interSemiBold,
    color: colors.textPrimary,
  },
  empty: { alignItems: 'center', paddingVertical: spacing['2xl'] },
  emptyText: { color: colors.textSecondary, marginBottom: spacing.base },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.base,
    marginBottom: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.backgroundElevated,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  rank: {
    width: 28,
    textAlign: 'center',
    fontSize: fontSizes.lg,
    fontFamily: fontFamilies.interBold,
    color: colors.textTag,
    paddingTop: 10,
  },
  thumb: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.md,
    backgroundColor: colors.backgroundMuted,
  },
  thumbPh: { backgroundColor: colors.backgroundMuted },
  cardMain: { flex: 1, minWidth: 0 },
  cardName: {
    fontSize: fontSizes.lg,
    fontFamily: fontFamilies.interSemiBold,
    color: colors.textPrimary,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm, marginTop: 4 },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locText: { fontSize: fontSizes.xs, fontFamily: fontFamilies.inter, color: colors.textSecondary, maxWidth: 160 },
  dot: { color: colors.textSecondary, fontSize: fontSizes.xs },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#a01b4d',
    borderWidth: 1,
    borderColor: colors.browseAccentBorder,
  },
  badgeAlt: {
    backgroundColor: colors.browseAccentAlt,
    borderColor: '#9f1239',
  },
  badgeText: {
    fontSize: fontSizes.meta,
    fontFamily: fontFamilies.frauncesSemiBold,
    color: colors.textOnDark,
  },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: colors.surfaceLight,
    fontSize: fontSizes.micro,
    fontFamily: fontFamilies.interMedium,
    letterSpacing: 0.5,
    color: colors.textSecondary,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
    backgroundColor: 'rgba(250, 250, 250, 0.92)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(228, 228, 231, 0.5)',
    zIndex: 20,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
})
