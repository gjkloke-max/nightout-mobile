import { useRef } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import MapView, { Marker } from 'react-native-maps'
import { colors, fontFamilies, fontWeights, fontSizes } from '../../theme'

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

/**
 * Shared interactive map for Browse (Smart Search + Trending/For You).
 * Matches marker + user-location behavior across those flows.
 */
/** Ignore map onPress briefly after a marker press (both can fire on some platforms). */
const MARKER_MAP_PRESS_GUARD_MS = 450

export default function BrowseVenueMapView({
  venues,
  mapRef,
  onMarkerPress,
  /** Called when user taps empty map (not a venue pin) — clear selection */
  onMapBackgroundPress,
  selectedVenueId,
  userMapCoords,
  initialRegion,
  mapViewKey,
}) {
  const lastMarkerPressAt = useRef(0)

  const withCoords = (venues || []).filter(
    (v) => pickCoord(v.latitude) != null && pickCoord(v.longitude) != null
  )

  if (withCoords.length === 0) {
    return (
      <View style={styles.mapEmpty}>
        <Text style={styles.mapEmptyText}>No location data for these venues.</Text>
      </View>
    )
  }

  const handleMapPress = () => {
    if (!onMapBackgroundPress) return
    if (Date.now() - lastMarkerPressAt.current < MARKER_MAP_PRESS_GUARD_MS) return
    onMapBackgroundPress()
  }

  return (
    <MapView
      ref={mapRef}
      key={mapViewKey}
      style={styles.map}
      initialRegion={initialRegion}
      showsPointsOfInterest={false}
      onPress={onMapBackgroundPress ? handleMapPress : undefined}
    >
      {withCoords.map((v) => {
        const lat = pickCoord(v.latitude)
        const lng = pickCoord(v.longitude)
        const selected = selectedVenueId != null && String(selectedVenueId) === String(v.venue_id)
        return (
          <Marker
            key={String(v.venue_id)}
            coordinate={{ latitude: lat, longitude: lng }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
            onPress={() => {
              lastMarkerPressAt.current = Date.now()
              onMarkerPress?.(v)
            }}
          >
            <View style={[styles.markerRing, selected && styles.markerRingSelected]}>
              <View style={styles.markerBubble}>
                <Text style={styles.markerText}>{formatRating10(v)}</Text>
              </View>
            </View>
          </Marker>
        )
      })}
      {userMapCoords ? (
        <Marker
          coordinate={userMapCoords}
          anchor={{ x: 0.5, y: 0.5 }}
          tracksViewChanges={false}
          title="Your location"
          zIndex={1000}
        >
          <View style={styles.userLocationDot} />
        </Marker>
      ) : null}
    </MapView>
  )
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  mapEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    minHeight: 280,
  },
  mapEmptyText: {
    fontSize: fontSizes.sm,
    fontFamily: fontFamilies.inter,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  /** Figma map pins — white disc + rating; selected gets accent ring */
  markerRing: {
    padding: 3,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
  },
  markerRingSelected: {
    borderColor: colors.browseAccent,
  },
  markerBubble: {
    minWidth: 36,
    height: 32,
    paddingHorizontal: 8,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  markerText: {
    fontSize: fontSizes.meta,
    fontFamily: fontFamilies.fraunces,
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
    letterSpacing: -0.275,
  },
  userLocationDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#1A73E8',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.35,
    shadowRadius: 2,
    elevation: 4,
  },
})
