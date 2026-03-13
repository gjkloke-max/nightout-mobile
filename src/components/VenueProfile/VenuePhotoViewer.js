import { useState } from 'react'
import {
  View,
  Image,
  Pressable,
  Text,
  StyleSheet,
  Modal,
  Dimensions,
} from 'react-native'
import { colors, fontSizes, spacing } from '../../theme'

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')

export default function VenuePhotoViewer({ photos = [], initialIndex = 0, onClose }) {
  const [index, setIndex] = useState(initialIndex)

  if (!photos?.length) return null

  const goPrev = () => setIndex((i) => (i <= 0 ? photos.length - 1 : i - 1))
  const goNext = () => setIndex((i) => (i >= photos.length - 1 ? 0 : i + 1))
  const current = photos[index] || photos[0]

  return (
    <Modal visible transparent animationType="fade">
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeText}>×</Text>
        </Pressable>
        {photos.length > 1 ? (
          <>
            <Pressable style={[styles.nav, styles.navPrev]} onPress={(e) => { e.stopPropagation(); goPrev() }}>
              <Text style={styles.navText}>‹</Text>
            </Pressable>
            <Pressable style={[styles.nav, styles.navNext]} onPress={(e) => { e.stopPropagation(); goNext() }}>
              <Text style={styles.navText}>›</Text>
            </Pressable>
          </>
        ) : null}
        <Pressable style={styles.content} onPress={(e) => e.stopPropagation()}>
          <Image source={{ uri: current }} style={styles.image} resizeMode="contain" />
        </Pressable>
        {photos.length > 1 ? (
          <View style={styles.dots}>
            {photos.map((_, i) => (
              <Pressable
                key={i}
                style={[styles.dot, i === index && styles.dotActive]}
                onPress={() => setIndex(i)}
              />
            ))}
          </View>
        ) : null}
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: 50,
    right: spacing.base,
    zIndex: 10,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { color: '#fff', fontSize: 32, lineHeight: 36 },
  nav: {
    position: 'absolute',
    top: '50%',
    marginTop: -30,
    width: 44,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  navPrev: { left: spacing.sm },
  navNext: { right: spacing.sm },
  navText: { color: '#fff', fontSize: 40 },
  content: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.7, justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
  dots: {
    position: 'absolute',
    bottom: 50,
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  dotActive: { backgroundColor: '#fff' },
})
