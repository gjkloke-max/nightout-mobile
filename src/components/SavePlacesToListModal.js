import { useState, useEffect } from 'react'
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { X } from 'lucide-react-native'
import { getListsForAddModal, createList, addVenuesToListBulk } from '../utils/venueLists'
import { colors, fontSizes, fontFamilies, spacing, borderRadius } from '../theme'

export default function SavePlacesToListModal({ visible, onClose, venueIds = [], sourceTitle, onSaved }) {
  const insets = useSafeAreaInsets()
  const [lists, setLists] = useState([])
  const [loading, setLoading] = useState(false)
  const [addingToListId, setAddingToListId] = useState(null)
  const [error, setError] = useState(null)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)

  const ids = (venueIds || []).map((id) => Number(id)).filter((n) => !Number.isNaN(n))
  const count = ids.length

  useEffect(() => {
    if (!visible) return
    const load = async () => {
      setLoading(true)
      setError(null)
      const { data, error: err } = await getListsForAddModal()
      setLists(data || [])
      setError(err?.message || null)
      setLoading(false)
    }
    load()
  }, [visible])

  const handlePickList = async (listId) => {
    setAddingToListId(listId)
    setError(null)
    const { error: err } = await addVenuesToListBulk(listId, ids)
    setAddingToListId(null)
    if (err) {
      setError(err.message || 'Could not save')
      return
    }
    onSaved?.()
    onClose()
  }

  const handleCreate = async () => {
    const name = newName.trim()
    if (!name) {
      Alert.alert('Name required', 'Enter a name for the new list.')
      return
    }
    setCreating(true)
    setError(null)
    const { data: newList, error: createErr } = await createList(name, { list_visibility: 'public' })
    if (createErr || !newList?.list_id) {
      setCreating(false)
      setError(createErr?.message || 'Could not create list')
      return
    }
    setNewName('')
    const { error: bulkErr } = await addVenuesToListBulk(newList.list_id, ids)
    setCreating(false)
    if (bulkErr) {
      setError(bulkErr.message || 'Could not add places')
      return
    }
    onSaved?.()
    onClose()
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.wrap, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Save to my lists</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <X size={22} color={colors.textPrimary} />
          </Pressable>
        </View>
        {sourceTitle ? (
          <Text style={styles.context}>
            From <Text style={styles.bold}>{sourceTitle}</Text>
            {count > 0 ? ` · ${count} ${count === 1 ? 'place' : 'places'}` : ''}
          </Text>
        ) : null}
        {error ? <Text style={styles.errText}>{error}</Text> : null}
        {loading ? (
          <ActivityIndicator style={styles.loader} color={colors.browseAccent} />
        ) : (
          <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
            {(lists || []).map((l) => (
              <Pressable
                key={l.list_id}
                style={styles.row}
                onPress={() => handlePickList(l.list_id)}
                disabled={addingToListId != null || creating}
              >
                <Text style={styles.rowTitle} numberOfLines={2}>
                  {l.list_name}
                </Text>
                {addingToListId === l.list_id ? <ActivityIndicator color={colors.browseAccent} /> : <Text style={styles.chevron}>›</Text>}
              </Pressable>
            ))}
            <View style={styles.newBlock}>
              <Text style={styles.newLabel}>New list</Text>
              <TextInput
                style={styles.input}
                placeholder="List name"
                placeholderTextColor={colors.textMuted}
                value={newName}
                onChangeText={setNewName}
              />
              <Pressable
                style={[styles.createBtn, creating && styles.createBtnDisabled]}
                onPress={handleCreate}
                disabled={creating || addingToListId != null}
              >
                {creating ? (
                  <ActivityIndicator color={colors.textOnDark} />
                ) : (
                  <Text style={styles.createBtnText}>Create & save</Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        )}
      </View>
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
    fontSize: fontSizes.lg,
    fontFamily: fontFamilies.frauncesSemiBold,
    color: colors.textPrimary,
  },
  context: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.base,
    fontSize: fontSizes.sm,
    fontFamily: fontFamilies.inter,
    color: colors.textSecondary,
  },
  bold: { fontFamily: fontFamilies.interSemiBold, color: colors.textPrimary },
  errText: { color: colors.error, marginHorizontal: spacing.lg, marginBottom: spacing.sm },
  loader: { marginTop: spacing.xl },
  list: { flex: 1, paddingHorizontal: spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowTitle: { flex: 1, fontSize: fontSizes.base, fontFamily: fontFamilies.interSemiBold, color: colors.textPrimary },
  chevron: { fontSize: 22, color: colors.textMuted },
  newBlock: { marginTop: spacing.xl, marginBottom: spacing['2xl'] },
  newLabel: {
    fontSize: fontSizes.meta,
    fontFamily: fontFamilies.interSemiBold,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    paddingHorizontal: spacing.base,
    paddingVertical: 12,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: fontSizes.base,
    fontFamily: fontFamilies.inter,
    color: colors.textPrimary,
    backgroundColor: colors.backgroundElevated,
    marginBottom: spacing.base,
  },
  createBtn: {
    backgroundColor: colors.backgroundDark,
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: 'center',
  },
  createBtnDisabled: { opacity: 0.6 },
  createBtnText: { color: colors.textOnDark, fontFamily: fontFamilies.interSemiBold, fontSize: fontSizes.base },
})
