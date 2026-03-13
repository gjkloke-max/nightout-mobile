import { useRef, useState } from 'react'
import { View, ScrollView, Image, Pressable, StyleSheet, Dimensions, Text } from 'react-native'
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg'
import { Bookmark, Image as ImageIcon } from 'lucide-react-native'
import { colors, spacing, iconSizes } from '../../theme'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const GALLERY_HEIGHT = 240
const FADE_HEIGHT = 80

export default function VenueHeroGallery({ photos = [], onPhotoClick, onToggleFavorite, isFavorited, togglingFavorite }) {
  const scrollRef = useRef(null)
  const [currentIndex, setCurrentIndex] = useState(0)

  if (!photos?.length) {
    return (
      <View style={[styles.container, styles.empty]}>
        <View style={styles.placeholder}>
          <ImageIcon size={48} color={colors.textMuted} strokeWidth={1.5} />
        </View>
      </View>
    )
  }

  return (
    <View style={styles.wrapper}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH)
          setCurrentIndex(Math.min(idx, photos.length - 1))
        }}
      >
        {photos.map((url, i) => (
          <Pressable key={i} style={[styles.slide, { width: SCREEN_WIDTH }]} onPress={() => onPhotoClick?.(i)}>
            <Image source={{ uri: url }} style={styles.image} resizeMode="cover" />
          </Pressable>
        ))}
      </ScrollView>
      <View style={styles.fadeOverlay} pointerEvents="none">
        <Svg width={SCREEN_WIDTH} height={FADE_HEIGHT} style={styles.fadeSvg}>
          <Defs>
            <LinearGradient id="fade" x1="0" y1="0" x2="0" y2={FADE_HEIGHT} gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={colors.background} stopOpacity="0" />
              <Stop offset="1" stopColor={colors.background} stopOpacity="1" />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={SCREEN_WIDTH} height={FADE_HEIGHT} fill="url(#fade)" />
        </Svg>
      </View>
      <View style={styles.counter}>
        <Text style={styles.counterText}>{currentIndex + 1}/{photos.length}</Text>
      </View>
      {onToggleFavorite && (
        <Pressable
          style={styles.saveBtn}
          onPress={() => onToggleFavorite()}
          disabled={togglingFavorite}
        >
          <Bookmark
            size={iconSizes.button}
            color={colors.textPrimary}
            fill={isFavorited ? colors.textPrimary : 'transparent'}
            strokeWidth={2}
          />
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: { position: 'relative' },
  container: { flexGrow: 0 },
  empty: { height: GALLERY_HEIGHT, backgroundColor: colors.surface },
  scrollContent: {},
  slide: { height: GALLERY_HEIGHT, backgroundColor: colors.surface },
  image: { width: '100%', height: '100%' },
  fadeOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: FADE_HEIGHT,
  },
  fadeSvg: { position: 'absolute', bottom: 0, left: 0 },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counter: {
    position: 'absolute',
    bottom: spacing.sm,
    right: spacing.base,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 4,
  },
  counterText: { fontSize: 12, color: '#fff' },
  saveBtn: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.base,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: { fontSize: 18 },
})
