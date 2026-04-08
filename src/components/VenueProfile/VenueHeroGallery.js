import { useRef, useState } from 'react'
import { View, ScrollView, Image, Pressable, StyleSheet, Dimensions, Text } from 'react-native'
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg'
import { Image as ImageIcon, Share as ShareIcon } from 'lucide-react-native'
import { colors, spacing, iconSizes, fontFamilies } from '../../theme'
import { shareVenue } from '../../utils/venueShare'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const GALLERY_HEIGHT = 280
const FADE_HEIGHT = 100

export default function VenueHeroGallery({
  photos = [],
  onPhotoClick,
  venueName,
  venueId,
  controlsTop,
}) {
  const scrollRef = useRef(null)
  const [currentIndex, setCurrentIndex] = useState(0)

  const handleShare = () => {
    if (!venueId) return
    shareVenue({ venueId, venueName })
  }

  const shareTop = controlsTop != null ? controlsTop : spacing.sm
  const showShare = !!venueId

  if (!photos?.length) {
    return (
      <View style={[styles.container, styles.empty]}>
        <View style={styles.placeholder}>
          <ImageIcon size={48} color={colors.textMuted} strokeWidth={1.5} />
        </View>
        {showShare ? (
          <Pressable
            style={[styles.shareBtn, { top: shareTop }]}
            onPress={handleShare}
            hitSlop={12}
            accessibilityLabel="Share venue"
          >
            <ShareIcon size={iconSizes.button} color={colors.textPrimary} strokeWidth={2} />
          </Pressable>
        ) : null}
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
            <LinearGradient id="venueFade" x1="0" y1="0" x2="0" y2={FADE_HEIGHT} gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={colors.backgroundCanvas} stopOpacity="0" />
              <Stop offset="1" stopColor={colors.backgroundCanvas} stopOpacity="1" />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={SCREEN_WIDTH} height={FADE_HEIGHT} fill="url(#venueFade)" />
        </Svg>
      </View>
      <View style={styles.counter}>
        <Text style={styles.counterText}>
          {photos.length} photos
        </Text>
      </View>
      {showShare ? (
        <Pressable
          style={[styles.shareBtn, { top: shareTop }]}
          onPress={handleShare}
          hitSlop={12}
          accessibilityLabel="Share venue"
        >
          <ShareIcon size={iconSizes.button} color={colors.textPrimary} strokeWidth={2} />
        </Pressable>
      ) : null}
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
    zIndex: 2,
  },
  counterText: {
    fontSize: 10,
    fontFamily: fontFamilies.interBold,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  shareBtn: {
    position: 'absolute',
    right: spacing.base,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
})
