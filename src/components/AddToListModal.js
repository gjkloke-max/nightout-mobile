import { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { X } from 'lucide-react-native'
import { getListsForAddModal, addVenueToList } from '../utils/venueLists'
import { colors, fontSizes, fontWeights, spacing, iconSizes, fontFamilies } from '../theme'

function formatListMeta(list) {
  const n = list.item_count ?? 0
  const places = n === 1 ? 'PLACE' : 'PLACES'
  const vis = (list.list_visibility || 'public').toLowerCase()
  if (vis === 'public') {
    return `${n} ${places}`
  }
  const visLabel = vis === 'private' ? 'PRIVATE' : 'FOLLOWERS'
  return `${n} ${places} • ${visLabel}`
}

/**
 * @param {(ctx: { venueId: number, venueName?: string }) => void} [onNavigateToFullCreateList]
 *        When set, "Create new list" opens the shared Profile CreateList screen (not an inline mini-flow).
 */
export default function AddToListModal({
  isOpen,
  onClose,
  venueId,
  venueName,
  onAdded,
  onNavigateToFullCreateList,
}) {
  const insets = useSafeAreaInsets()
  const [lists, setLists] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedListIds, setSelectedListIds] = useState(() => new Set())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const loadLists = useCallback(async () => {
    setLoading(true)
    const { data, error: err } = await getListsForAddModal()
    setLists(data || [])
    setError(err?.message || null)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (isOpen && venueId) {
      loadLists()
      setError(null)
      setSelectedListIds(new Set())
    }
  }, [isOpen, venueId, loadLists])

  const toggleList = (listId) => {
    setSelectedListIds((prev) => {
      const next = new Set(prev)
      if (next.has(listId)) next.delete(listId)
      else next.add(listId)
      return next
    })
  }

  const handleDone = async () => {
    if (!venueId) return
    if (selectedListIds.size === 0) {
      onClose()
      return
    }
    setSaving(true)
    setError(null)
    for (const listId of selectedListIds) {
      const { error: err } = await addVenueToList(listId, venueId)
      if (err) {
        const msg = (err.message || '').toLowerCase()
        const dup = msg.includes('duplicate') || msg.includes('unique') || msg.includes('already')
        if (!dup) {
          setError(err.message || 'Failed to add')
          setSaving(false)
          return
        }
      }
    }
    setSaving(false)
    onAdded?.()
    onClose()
  }

  const handleCancel = () => {
    onClose()
  }

  const handleCreateNewListPress = () => {
    if (!venueId || !onNavigateToFullCreateList) return
    onNavigateToFullCreateList({ venueId, venueName })
    onClose()
  }

  if (!isOpen) return null

  const useFullCreateFlow = typeof onNavigateToFullCreateList === 'function'

  return (
    <Modal visible transparent animationType="fade" onRequestClose={handleCancel}>
      <Pressable style={styles.overlay} onPress={handleCancel}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.title}>Add to List</Text>
              {venueName ? <Text style={styles.venueName}>{venueName}</Text> : null}
            </View>
            <Pressable onPress={handleCancel} style={styles.closeBtn} hitSlop={12} accessibilityLabel="Close">
              <X size={20} color={colors.textPrimary} strokeWidth={2} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <Pressable
              style={[styles.createTile, !useFullCreateFlow && styles.createTileDisabled]}
              onPress={useFullCreateFlow ? handleCreateNewListPress : undefined}
              disabled={!useFullCreateFlow}
            >
              <View style={styles.createIconWrap}>
                <Text style={styles.createPlus}>+</Text>
              </View>
              <Text style={styles.createLabel}>CREATE NEW LIST</Text>
            </Pressable>

            <Text style={styles.sectionLabel}>YOUR LISTS</Text>
            {loading ? (
              <Text style={styles.muted}>Loading lists...</Text>
            ) : lists.length === 0 ? (
              <Text style={styles.muted}>You don&apos;t have any lists yet.</Text>
            ) : (
              lists.map((list) => {
                const checked = selectedListIds.has(list.list_id)
                return (
                  <Pressable
                    key={list.list_id}
                    style={[styles.listRow, checked && styles.listRowSelected]}
                    onPress={() => toggleList(list.list_id)}
                  >
                    <View style={styles.listRowText}>
                      <Text style={styles.listTitle} numberOfLines={1}>
                        {list.list_name}
                      </Text>
                      <Text style={styles.listMeta}>{formatListMeta(list)}</Text>
                    </View>
                    <View style={[styles.check, checked && styles.checkOn]}>
                      {checked ? (
                        <Text style={styles.checkMark} accessibilityLabel="selected">
                          ✓
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                )
              })
            )}

            {error ? <Text style={styles.err}>{error}</Text> : null}
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: Math.max(spacing.lg, insets.bottom + 12) }]}>
            <Pressable style={styles.btnCancel} onPress={handleCancel}>
              <Text style={styles.btnCancelText}>CANCEL</Text>
            </Pressable>
            <Pressable
              style={[styles.btnDone, saving && styles.btnDoneDisabled]}
              onPress={handleDone}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.btnDoneText}>DONE</Text>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  sheet: {
    width: '100%',
    maxWidth: 448,
    maxHeight: '88%',
    backgroundColor: '#fafaf8',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingTop: 20,
    paddingBottom: 19,
    borderBottomWidth: 1,
    borderBottomColor: '#e4e4e7',
    minHeight: 88,
  },
  headerText: {
    flex: 1,
    gap: 4,
    paddingRight: spacing.sm,
  },
  title: {
    fontFamily: fontFamilies.frauncesRegular,
    fontSize: fontSizes.xl,
    lineHeight: 28,
    color: colors.textPrimary,
  },
  venueName: {
    fontFamily: fontFamilies.frauncesItalic,
    fontSize: fontSizes.xs,
    lineHeight: 16,
    color: '#71717b',
  },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { maxHeight: 380 },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  createTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 76,
    paddingLeft: 18,
    paddingRight: 8,
    paddingVertical: 2,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#d4d4d8',
  },
  createTileDisabled: { opacity: 0.45 },
  createIconWrap: {
    width: 40,
    height: 40,
    backgroundColor: '#18181b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  createPlus: {
    color: '#fff',
    fontSize: 22,
    fontWeight: fontWeights.normal,
    marginTop: -2,
  },
  createLabel: {
    fontFamily: fontFamilies.interBold,
    fontSize: fontSizes.xs,
    letterSpacing: 1.2,
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
  },
  sectionLabel: {
    marginTop: spacing.sm,
    marginBottom: 0,
    fontFamily: fontFamilies.interBold,
    fontSize: 10,
    letterSpacing: 1.12,
    fontWeight: fontWeights.bold,
    color: '#71717b',
  },
  muted: { fontSize: fontSizes.sm, color: '#71717b' },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 76,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#e4e4e7',
    backgroundColor: '#fff',
    marginBottom: spacing.sm,
  },
  listRowSelected: {
    backgroundColor: '#f4f4f5',
    opacity: 0.95,
  },
  listRowText: { flex: 1, minWidth: 0, gap: 4 },
  listTitle: {
    fontFamily: fontFamilies.frauncesRegular,
    fontSize: fontSizes.base,
    lineHeight: 24,
    color: colors.textPrimary,
  },
  listMeta: {
    fontFamily: fontFamilies.interMedium,
    fontSize: 10,
    letterSpacing: 1.12,
    fontWeight: fontWeights.medium,
    color: '#71717b',
    textTransform: 'uppercase',
  },
  check: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#d4d4d8',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  checkOn: {
    borderColor: '#18181b',
    backgroundColor: '#18181b',
  },
  checkMark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: fontWeights.bold,
    marginTop: -1,
  },
  err: { color: colors.error, fontSize: fontSizes.sm, marginTop: spacing.sm },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: spacing.lg,
    paddingTop: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e4e4e7',
  },
  btnCancel: {
    flex: 1,
    height: 45,
    borderWidth: 1,
    borderColor: '#d4d4d8',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  btnCancelText: {
    fontFamily: fontFamilies.interBold,
    fontSize: fontSizes.xs,
    letterSpacing: 1.2,
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
  },
  btnDone: {
    flex: 1,
    height: 45,
    backgroundColor: '#18181b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDoneDisabled: { opacity: 0.5 },
  btnDoneText: {
    fontFamily: fontFamilies.interBold,
    fontSize: fontSizes.xs,
    letterSpacing: 1.2,
    fontWeight: fontWeights.bold,
    color: '#fff',
  },
})
