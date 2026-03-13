import { useRef } from 'react'
import { View, ScrollView, Image, Pressable, StyleSheet, Dimensions, Text } from 'react-native'
import { colors, spacing } from '../../theme'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const GALLERY_HEIGHT = 240

export default function VenueHeroGallery({ photos = [], onPhotoClick }) {
  const scrollRef = useRef(null)

  if (!photos?.length) {
    return (
      <View style={[styles.container, styles.empty]}>
        <View style={styles.placeholder}>
          <Text style={styles.placeholderIcon}>📷</Text>
        </View>
      </View>
    )
  }

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
    >
      {photos.map((url, i) => (
        <Pressable key={i} style={[styles.slide, { width: SCREEN_WIDTH }]} onPress={() => onPhotoClick?.(i)}>
          <Image source={{ uri: url }} style={styles.image} resizeMode="cover" />
        </Pressable>
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flexGrow: 0 },
  empty: { height: GALLERY_HEIGHT, backgroundColor: colors.surface },
  scrollContent: {},
  slide: { height: GALLERY_HEIGHT, backgroundColor: colors.surface },
  image: { width: '100%', height: '100%' },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderIcon: { fontSize: 48 },
})
