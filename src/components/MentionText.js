import { useMemo } from 'react'
import { Text } from 'react-native'
import { useNavigation } from '@react-navigation/native'

const SPLIT = /(@[a-z0-9_]{3,30}\b)/gi

/**
 * @param {{ text: string, mentionProfiles?: { id: string, username?: string|null }[], style?: object, mentionStyle?: object }} props
 */
export default function MentionText({ text, mentionProfiles = [], style, mentionStyle }) {
  const navigation = useNavigation()
  const userByUsername = useMemo(() => {
    const m = {}
    for (const p of mentionProfiles) {
      const u = (p?.username || '').toLowerCase()
      if (u && p?.id) m[u] = String(p.id)
    }
    return m
  }, [mentionProfiles])

  if (text == null || text === '') return null

  const parts = String(text).split(SPLIT)
  return (
    <Text style={style}>
      {parts.map((part, i) => {
        if (part && part.startsWith('@')) {
          const handle = part.slice(1)
          const uid = userByUsername[handle.toLowerCase()]
          if (uid) {
            return (
              <Text
                key={`m-${i}`}
                onPress={() => navigation.navigate('FriendProfile', { userId: uid })}
                style={[{ color: '#9d174d', fontWeight: '600' }, mentionStyle]}
              >
                {part}
              </Text>
            )
          }
        }
        return <Text key={`p-${i}`}>{part}</Text>
      })}
    </Text>
  )
}
