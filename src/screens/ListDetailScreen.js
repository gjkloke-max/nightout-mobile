import { useState, useEffect, useLayoutEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Image,
  Share,
  Alert,
  Modal,
} from 'react-native'
import { useRoute, useNavigation } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ChevronLeft, MoreVertical, MapPin, Share2, Heart } from 'lucide-react-native'
import { useAuth } from '../contexts/AuthContext'
import { getListWithItems, removeVenueFromList, deleteList } from '../utils/venueLists'
import {
  getLikeCountsByListIds,
  getLikedListIds,
  toggleListLike,
} from '../services/listLikes'
import { deriveBrowseTagPair } from '../utils/browseVenueTags'
import AddVenuesToListModal from '../components/AddVenuesToListModal'
import SavePlacesToListModal from '../components/SavePlacesToListModal'
import { config } from '../lib/config'
import { colors, fontSizes, fontFamilies, spacing, borderRadius } from '../theme'

/** Content height reserved below safe area so the hero sits under the icon row (not under the frosted bar) */
const LIST_HEADER_ROW_HEIGHT = 52

function displayNameFromProfile(p) {
  const fn = (p?.first_name || '').trim()
  const ln = (p?.last_name || '').trim()
  return [fn, ln].filter(Boolean).join(' ') || ''
}

function formatUpdatedLabel(d) {
  if (!d) return ''
  const date = new Date(d)
  const now = new Date()
  const diffDays = Math.ceil((now - date) / (1000 * 60 * 60 * 24))
  if (diffDays <= 0) return 'Updated today'
  if (diffDays === 1) return 'Updated yesterday'
  if (diffDays < 7) return `Updated ${diffDays} days ago`
  if (diffDays < 30) return `Updated ${Math.floor(diffDays / 7)} weeks ago`
  return `Updated ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
}

export default function ListDetailScreen() {
  const route = useRoute()
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const listId = route?.params?.listId

  const [list, setList] = useState(null)
  const [loading, setLoading] = useState(true)
  const [removingId, setRemovingId] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [showAddVenues, setShowAddVenues] = useState(false)
  const [showSavePlaces, setShowSavePlaces] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [liked, setLiked] = useState(false)
  const [likeEngageLoading, setLikeEngageLoading] = useState(true)
  const [likeToggling, setLikeToggling] = useState(false)

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false })
  }, [navigation])

  const loadList = useCallback(async () => {
    setLoading(true)
    const { data, error } = await getListWithItems(listId)
    if (error && !data) {
      setList(null)
    } else {
      setList(data)
    }
    setLoading(false)
  }, [listId])

  useEffect(() => {
    if (listId) loadList()
  }, [listId, loadList])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const id = list?.list_id
      if (!id || !user?.id) {
        if (!cancelled) {
          setLikeCount(0)
          setLiked(false)
          setLikeEngageLoading(false)
        }
        return
      }
      setLikeEngageLoading(true)
      const [counts, likedSet] = await Promise.all([
        getLikeCountsByListIds([id]),
        getLikedListIds(user.id, [id]),
      ])
      if (cancelled) return
      setLikeCount(counts[id] ?? 0)
      setLiked(likedSet.has(id))
      setLikeEngageLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [list?.list_id, user?.id])

  const handleToggleLike = async () => {
    if (!user?.id || !list?.list_id || likeToggling) return
    if (list.user_id === user.id) return
    const id = list.list_id
    setLikeToggling(true)
    const { success } = await toggleListLike(user.id, id, liked)
    if (success) {
      setLiked((v) => !v)
      setLikeCount((c) => Math.max(0, liked ? c - 1 : c + 1))
    }
    setLikeToggling(false)
  }

  const handleVenuePress = (venue) => {
    const vid = venue?.venue_id
    if (!vid) return
    navigation.navigate('VenueProfile', { venueId: vid })
  }

  const handleRemove = async (listItemId) => {
    setRemovingId(listItemId)
    await removeVenueFromList(listItemId)
    setList((prev) => (prev ? { ...prev, items: prev.items.filter((i) => i.list_item_id !== listItemId) } : null))
    setRemovingId(null)
  }

  const handleShare = async () => {
    const path = `/lists/${listId}`
    const url = config.webAppUrl ? `${config.webAppUrl.replace(/\/$/, '')}${path}` : path
    try {
      await Share.share({
        message: list?.list_name ? `${list.list_name} — ${url}` : url,
        title: list?.list_name || 'List',
      })
    } catch {
      /* cancelled */
    }
    setMenuOpen(false)
  }

  const handleDeleteList = () => {
    setMenuOpen(false)
    Alert.alert('Delete list', `Delete "${list?.list_name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await deleteList(listId)
          if (error) {
            Alert.alert('Error', error.message || 'Could not delete')
            return
          }
          navigation.goBack()
        },
      },
    ])
  }

  if (!listId) {
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

  const isOwner = user?.id && list.user_id === user.id
  const items = list.items || []
  const heroPhotos = items
    .map((i) => i.venue?.primary_photo_url)
    .filter(Boolean)
    .slice(0, 3)
  const creatorName = displayNameFromProfile(list.creator_profile || {})
  const venueIds = items.map((i) => i.venue_id).filter(Boolean)
  const metaLine = [`${items.length} ${items.length === 1 ? 'place' : 'places'}`, formatUpdatedLabel(list.updated_at)].join(
    ' • '
  )

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
          <Text style={styles.title}>{list.list_name}</Text>
          <Text style={styles.meta}>{metaLine}</Text>
          {creatorName ? <Text style={styles.creator}>Created by {creatorName}</Text> : null}

          <View style={styles.actions}>
            {isOwner ? (
              <Pressable style={styles.primaryBtn} onPress={() => setShowAddVenues(true)}>
                <Text style={styles.primaryBtnText}>+ Add Place</Text>
              </Pressable>
            ) : (
              <Pressable style={styles.primaryBtn} onPress={() => setShowSavePlaces(true)}>
                <Text style={styles.primaryBtnText}>Save to My Lists</Text>
              </Pressable>
            )}
            {!isOwner && (
              <Pressable
                style={[styles.likeCircle, liked && styles.likeCircleActive]}
                onPress={handleToggleLike}
                disabled={likeEngageLoading || likeToggling}
                accessibilityLabel={liked ? 'Unlike list' : 'Like list'}
              >
                <Heart
                  size={22}
                  color={liked ? colors.browseAccent : colors.textMuted}
                  fill={liked ? colors.browseAccent : 'transparent'}
                  strokeWidth={2}
                />
                {!likeEngageLoading && likeCount > 0 ? (
                  <Text style={styles.likeCountText}>{likeCount}</Text>
                ) : null}
              </Pressable>
            )}
            <Pressable style={styles.shareCircle} onPress={handleShare} accessibilityLabel="Share list">
              <Share2 size={22} color={colors.textPrimary} strokeWidth={1.75} />
            </Pressable>
          </View>

          <Text style={styles.sectionTitle}>Places in this list</Text>

          {!items.length ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No places yet.</Text>
              {isOwner ? (
                <Pressable style={styles.primaryBtn} onPress={() => setShowAddVenues(true)}>
                  <Text style={styles.primaryBtnText}>+ Add Place</Text>
                </Pressable>
              ) : null}
            </View>
          ) : (
            items.map((item, index) => {
              const v = item.venue
              if (!v) return null
              const tags = deriveBrowseTagPair(v)
              const rating = v.rating10 != null && v.rating10 !== '' ? Number(v.rating10).toFixed(1) : null
              const neighborhood = (v.neighborhood_name || v.city || '').trim()
              const badgeAlt = index % 2 === 1
              return (
                <View key={item.list_item_id} style={styles.card}>
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
                    {isOwner ? (
                      <View style={styles.ownerRow}>
                        <Pressable
                          onPress={() => handleRemove(item.list_item_id)}
                          disabled={removingId === item.list_item_id}
                        >
                          {removingId === item.list_item_id ? (
                            <ActivityIndicator size="small" color={colors.error} />
                          ) : (
                            <Text style={styles.remove}>Remove</Text>
                          )}
                        </Pressable>
                      </View>
                    ) : null}
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
        <Pressable style={styles.iconBtn} onPress={() => setMenuOpen(true)} accessibilityLabel="More options">
          <MoreVertical size={22} color={colors.textPrimary} strokeWidth={2} />
        </Pressable>
      </View>

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <View style={styles.menuModalRoot}>
          <Pressable style={styles.menuBackdrop} onPress={() => setMenuOpen(false)} />
          <View style={[styles.menuSheet, { top: insets.top + 52 }]}>
            <Pressable style={styles.menuItem} onPress={() => handleShare()}>
              <Text style={styles.menuItemText}>Share list</Text>
            </Pressable>
            {isOwner ? (
              <Pressable style={styles.menuItem} onPress={handleDeleteList}>
                <Text style={[styles.menuItemText, styles.menuDanger]}>Delete list</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </Modal>

      {isOwner && (
        <AddVenuesToListModal
          visible={showAddVenues}
          onClose={() => setShowAddVenues(false)}
          listId={listId}
          listName={list.list_name}
          existingVenueIds={venueIds}
          onAdded={loadList}
        />
      )}

      {!isOwner && (
        <SavePlacesToListModal
          visible={showSavePlaces}
          onClose={() => setShowSavePlaces(false)}
          venueIds={venueIds}
          sourceTitle={list.list_name}
          onSaved={loadList}
        />
      )}
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
  primaryBtn: {
    flex: 1,
    backgroundColor: colors.backgroundDark,
    borderRadius: 999,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.base,
  },
  primaryBtnText: {
    color: colors.textOnDark,
    fontSize: fontSizes.base,
    fontFamily: fontFamilies.interSemiBold,
  },
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
  likeCircle: {
    minWidth: 56,
    minHeight: 56,
    paddingHorizontal: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundElevated,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  likeCircleActive: {
    borderColor: 'rgba(157, 23, 77, 0.25)',
  },
  likeCountText: {
    fontSize: 11,
    fontFamily: fontFamilies.interBold,
    color: colors.textSecondary,
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
  ownerRow: { marginTop: spacing.sm },
  remove: { fontSize: fontSizes.xs, color: colors.error, textDecorationLine: 'underline' },
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
  menuModalRoot: { flex: 1 },
  menuBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  menuSheet: {
    position: 'absolute',
    right: spacing.md,
    backgroundColor: colors.backgroundElevated,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 168,
    zIndex: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  menuItem: { paddingVertical: 14, paddingHorizontal: spacing.lg },
  menuItemText: { fontSize: fontSizes.base, fontFamily: fontFamilies.inter, color: colors.textPrimary },
  menuDanger: { color: colors.error },
})
