import { extractMentionTokens } from '../utils/mentions'
import { lookupUserIdsByMentionTokens } from './profileUsername'

export async function resolveMentionedUserIds(text, pickedUserIds = []) {
  const tokens = extractMentionTokens(text)
  const tokenMap = await lookupUserIdsByMentionTokens(tokens)
  const ids = new Set((pickedUserIds || []).filter(Boolean).map(String))
  for (const id of tokenMap.values()) ids.add(id)
  return [...ids]
}
