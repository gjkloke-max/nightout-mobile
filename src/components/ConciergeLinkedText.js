import { Text } from 'react-native'
import { splitTextWithVenueLinks } from '../utils/conciergeLinkUtils'

export default function ConciergeLinkedText({ content, venues, textStyle, linkStyle, onVenuePress }) {
  const segments = splitTextWithVenueLinks(content, venues || [])
  return (
    <Text style={textStyle}>
      {segments.map((seg, i) =>
        seg.type === 'venue' ? (
          <Text
            key={`v-${i}`}
            onPress={() => onVenuePress?.(seg.venueId)}
            style={linkStyle}
            accessibilityRole="link"
          >
            {seg.text}
          </Text>
        ) : (
          <Text key={`t-${i}`}>{seg.text}</Text>
        )
      )}
    </Text>
  )
}
