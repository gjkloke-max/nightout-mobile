import { useState, useEffect } from 'react'
import {
  View,
  Text,
  Modal,
  Pressable,
  TextInput,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native'
import {
  getListsForAddModal,
  createList,
  addVenueToList,
} from '../utils/venueLists'
import CreateListModal from './CreateListModal'
import { colors, fontSizes, fontWeights, spacing } from '../theme'

export default function AddToListModal({ isOpen, onClose, venueId, venueName, onAdded }) {
  const [lists, setLists] = useState([])
  const [loading, setLoading] = useState(false)
  const [addingToListId, setAddingToListId] = useState(null)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [note, setNote] = useState('')

  useEffect(() => {
    if (isOpen && venueId) {
      loadLists()
      setError(null)
      setSuccess(null)
      setNote('')
    }
  }, [isOpen, venueId])

  const loadLists = async () => {
    setLoading(true)
    const { data, error: err } = await getListsForAddModal()
    setLists(data || [])
    setError(err?.message || null)
    setLoading(false)
  }

  const handleAddToList = async (listId) => {
    setAddingToListId(listId)
    setError(null)
    setSuccess(null)
    const { data, error: err } = await addVenueToList(listId, venueId, note)
    setAddingToListId(null)
    if (err) {
      setError(err.message || 'Failed to add')
      return
    }
    setSuccess(`${venueName || 'Venue'} added to list`)
    setNote('')
    onAdded?.()
    setTimeout(() => onClose(), 800)
  }

  const handleCreateAndAdd = async (listName) => {
    setCreating(true)
    setError(null)
    const { data: newList, error: createErr } = await createList(listName)
    if (createErr) {
      setCreating(false)
      return { data: null, error: createErr }
    }
    setShowCreate(false)
    await loadLists()
    await handleAddToList(newList.list_id)
    setCreating(false)
    return { data: newList, error: null }
  }

  if (!isOpen) return null

  return (
    <>
      <Modal visible transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={onClose}>
          <Pressable style={styles.content} onPress={(e) => e.stopPropagation()}>
            <View style={styles.header}>
              <Text style={styles.title}>Add to list</Text>
              <Pressable onPress={onClose} style={styles.closeBtn}>
                <Text style={styles.closeText}>×</Text>
              </Pressable>
            </View>
            <ScrollView style={styles.body}>
              {venueName ? (
                <Text style={styles.venueContext}>
                  Adding <Text style={styles.venueName}>{venueName}</Text>
                </Text>
              ) : null}
              <View style={styles.field}>
                <Text style={styles.label}>Note (optional)</Text>
                <TextInput
                  style={styles.input}
                  value={note}
                  onChangeText={setNote}
                  placeholder="e.g. Try the margaritas"
                  maxLength={200}
                />
              </View>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              {success ? <Text style={styles.success}>{success}</Text> : null}
              {loading ? (
                <Text style={styles.loadingText}>Loading lists...</Text>
              ) : lists.length === 0 ? (
                <View style={styles.empty}>
                  <Text style={styles.emptyText}>You don't have any lists yet.</Text>
                  <Pressable style={styles.btnPrimary} onPress={() => setShowCreate(true)}>
                    <Text style={styles.btnPrimaryText}>Create your first list</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.lists}>
                  <Text style={styles.listsLabel}>Choose a list</Text>
                  {lists.map((list) => (
                    <Pressable
                      key={list.list_id}
                      style={styles.listOption}
                      onPress={() => handleAddToList(list.list_id)}
                      disabled={addingToListId !== null}
                    >
                      <Text style={styles.listName}>{list.list_name}</Text>
                      {addingToListId === list.list_id ? (
                        <ActivityIndicator size="small" color={colors.accent} />
                      ) : null}
                    </Pressable>
                  ))}
                  <Pressable style={styles.createLink} onPress={() => setShowCreate(true)}>
                    <Text style={styles.createLinkText}>+ Create new list</Text>
                  </Pressable>
                </View>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
      <CreateListModal
        isOpen={showCreate}
        onClose={() => { setShowCreate(false); setCreating(false) }}
        onCreate={handleCreateAndAdd}
        loading={creating}
      />
    </>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  content: {
    backgroundColor: colors.backgroundElevated,
    borderRadius: 12,
    width: '100%',
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  title: { fontSize: fontSizes.xl, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  closeBtn: { padding: spacing.sm },
  closeText: { fontSize: 28, color: colors.textMuted },
  body: { padding: spacing.base },
  venueContext: { fontSize: fontSizes.sm, color: colors.textSecondary, marginBottom: spacing.md },
  venueName: { fontWeight: fontWeights.semibold },
  field: { marginBottom: spacing.md },
  label: { fontSize: fontSizes.sm, color: colors.textSecondary, marginBottom: spacing.xs },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    fontSize: fontSizes.base,
    color: colors.textPrimary,
  },
  error: { fontSize: fontSizes.sm, color: colors.error, marginBottom: spacing.sm },
  success: { fontSize: fontSizes.sm, color: colors.success, marginBottom: spacing.sm },
  loadingText: { fontSize: fontSizes.sm, color: colors.textMuted },
  empty: { alignItems: 'center', paddingVertical: spacing.xl },
  emptyText: { fontSize: fontSizes.sm, color: colors.textMuted, marginBottom: spacing.lg },
  btnPrimary: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    backgroundColor: colors.accent,
  },
  btnPrimaryText: { fontSize: fontSizes.base, color: colors.textOnDark, fontWeight: '600' },
  lists: {},
  listsLabel: { fontSize: fontSizes.sm, color: colors.textSecondary, marginBottom: spacing.sm },
  listOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  listName: { fontSize: fontSizes.base, color: colors.textPrimary },
  createLink: { paddingVertical: spacing.lg },
  createLinkText: { fontSize: fontSizes.base, color: colors.link },
})
