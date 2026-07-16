import { Text } from 'react-native'
import { splitTextWithVenueLinks } from '../utils/conciergeLinkUtils'
import TrendingBadge from './TrendingBadge'
import { isVenueInTrendingPool } from '../utils/venueTrending'

export default function ConciergeLinkedText({ content, venues, textStyle, linkStyle, onVenuePress }) {
  const segments = splitTextWithVenueLinks(content, venues || [])
  const trendingIds = new Set(
    (venues || [])
      .filter(isVenueInTrendingPool)
      .map((v) => Number(v.venueId ?? v.venue_id))
      .filter((id) => !Number.isNaN(id))
  )
  return (
    <Text style={textStyle}>
      {segments.map((seg, i) =>
        seg.type === 'venue' ? (
          <Text key={`v-${i}`}>
            <Text
              onPress={() => onVenuePress?.(seg.venueId)}
              style={linkStyle}
              accessibilityRole="link"
            >
              {seg.text}
            </Text>
            {!Number.isNaN(Number(seg.venueId)) && trendingIds.has(Number(seg.venueId)) ? (
              <TrendingBadge />
            ) : null}
          </Text>
        ) : (
          <Text key={`t-${i}`}>{seg.text}</Text>
        )
      )}
    </Text>
  )
}
