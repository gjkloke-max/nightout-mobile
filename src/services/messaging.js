/**
 * Direct messaging — schema: migrations/dm_messaging.sql (run on Supabase)
 */

import { supabase } from '../lib/supabase'

export function dispatchDmBadgeRefresh() {
  /* Web uses window event; mobile refreshes on focus / interval */
}

export function displayNameFromProfile(p) {
  if (!p) return 'Unknown'
  const parts = [p.first_name, p.last_name].filter(Boolean)
  return parts.length ? parts.join(' ') : 'Unknown'
}

export function formatDmHandle(p) {
  if (!p) return ''
  const a = (p.first_name || '').trim().toLowerCase().replace(/[^a-z0-9]/gi, '')
  const b = (p.last_name || '').trim().toLowerCase().replace(/[^a-z0-9]/gi, '')
  if (a && b) return `@${a}_${b}`
  if (a) return `@${a}`
  return ''
}

export async function getGlobalUnreadDmCount() {
  const { data, error } = await supabase.rpc('dm_global_unread_count')
  if (error) {
    console.warn('dm_global_unread_count', error)
    return 0
  }
  return typeof data === 'number' ? data : Number(data) || 0
}

export async function listConversations(userId) {
  if (!userId) return []
  const { data, error } = await supabase.rpc('dm_list_conversations', { p_user_id: userId })
  if (error) {
    console.warn('dm_list_conversations', error)
    return []
  }
  return (data || []).map((row) => ({
    ...row,
    unread_count: Number(row.unread_count) || 0,
  }))
}

export async function getOrCreateDirectConversation(otherUserId) {
  const { data, error } = await supabase.rpc('dm_get_or_create_direct_conversation', {
    p_other_user_id: otherUserId,
  })
  if (error) throw error
  return data
}

export async function fetchMessages(conversationId, limit = 100) {
  const { data, error } = await supabase
    .from('dm_messages')
    .select('id, sender_user_id, body, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) throw error
  return data || []
}

export async function sendMessage(conversationId, body) {
  const trimmed = (body || '').trim()
  if (!trimmed) throw new Error('empty message')

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('not authenticated')

  const { data, error } = await supabase
    .from('dm_messages')
    .insert({
      conversation_id: conversationId,
      sender_user_id: user.id,
      body: trimmed,
    })
    .select('id, sender_user_id, body, created_at')
    .single()

  if (error) throw error
  return data
}

export async function markConversationRead(conversationId, userId) {
  if (!conversationId || !userId) return

  const { data: maxRow } = await supabase
    .from('dm_messages')
    .select('created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const readAt = maxRow?.created_at || new Date().toISOString()

  await supabase
    .from('dm_conversation_participants')
    .update({ last_read_at: readAt })
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
}

export async function listSuggestedDmUsers(currentUserId) {
  if (!currentUserId) return []

  const { data: follows, error: fErr } = await supabase
    .from('user_follows')
    .select('followed_user_id')
    .eq('follower_user_id', currentUserId)
    .limit(200)

  if (fErr) {
    console.warn('listSuggestedDmUsers follows', fErr)
    return []
  }

  const ids = [...new Set((follows || []).map((r) => r.followed_user_id))].filter(Boolean)
  if (ids.length === 0) return []

  const { data: profiles, error: pErr } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, avatar_url')
    .in('id', ids)

  if (pErr) {
    console.warn('listSuggestedDmUsers profiles', pErr)
    return []
  }

  return profiles || []
}

export function subscribeToConversationMessages(conversationId, onInsert) {
  const channel = supabase
    .channel(`dm:${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'dm_messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        onInsert(payload.new)
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}
