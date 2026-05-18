import { useEffect, useState } from 'react'
import { View, StyleSheet } from 'react-native'
import MapView, { Marker } from 'react-native-maps'
import * as Location from 'expo-location'
import { colors } from '../../theme'

/** ~street-level preview; matches web VenueLocationMiniMap intent */
const LAT_DELTA = 0.008
const LNG_DELTA = 0.008

/**
 * Map preview under the venue address (react-native-maps).
 * Pan, pinch zoom, and double-tap zoom (where supported). Parent VenueProfile ScrollView uses
 * nestedScrollEnabled so Android can hand nested drags to the map when appropriate.
 * Requests location permission when needed so your position can appear on the map (same policy as Browse).
 */
export default function VenueLocationMiniMap({ lat, lng, venueId }) {
  const [showsUserLocation, setShowsUserLocation] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { status: existing } = await Location.getForegroundPermissionsAsync()
        if (existing === 'granted') {
          if (!cancelled) setShowsUserLocation(true)
          return
        }
        if (existing !== 'undetermined') {
          return
        }
        const { status } = await Location.requestForegroundPermissionsAsync()
        if (!cancelled && status === 'granted') setShowsUserLocation(true)
      } catch {
        /* keep map without user dot */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const region = {
    latitude: lat,
    longitude: lng,
    latitudeDelta: LAT_DELTA,
    longitudeDelta: LNG_DELTA,
  }

  return (
    <View style={styles.wrap} accessibilityLabel="Map showing venue location" accessible>
      <MapView
        key={venueId != null ? String(venueId) : `${lat},${lng}`}
        style={styles.map}
        initialRegion={region}
        scrollEnabled
        zoomEnabled
        zoomTapEnabled
        pitchEnabled={false}
        rotateEnabled={false}
        showsPointsOfInterest={false}
        showsUserLocation={showsUserLocation}
        toolbarEnabled={false}
      >
        <Marker
          coordinate={{ latitude: lat, longitude: lng }}
          tracksViewChanges={false}
          anchor={{ x: 0.5, y: 0.5 }}
        >
          <View style={styles.marker} />
        </Marker>
      </MapView>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 14,
    height: 176,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.borderLight,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  marker: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.browseAccent,
    borderWidth: 2,
    borderColor: '#fff',
  },
})
