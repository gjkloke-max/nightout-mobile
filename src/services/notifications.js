import { supabase } from '../lib/supabase'

export async function getNotifications(userId, limit = 50) {
  if (!userId || !supabase) return []
  const { data } = await supabase
    .from('notifications')
    .select('id, user_id, type, payload, is_read, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  return data || []
}

export async function getUnreadCount(userId) {
  if (!userId || !supabase) return 0
  const { count } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false)
  return count ?? 0
}

export async function markAsRead(notificationId, userId) {
  if (!notificationId || !userId || !supabase) return { success: false }
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
    .eq('user_id', userId)
  return { success: !error }
}

export async function markAllAsRead(userId) {
  if (!userId || !supabase) return { success: false }
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
  return { success: !error }
}

export async function deleteNotification(notificationId, userId) {
  if (!notificationId || !userId || !supabase) return { success: false }
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', notificationId)
    .eq('user_id', userId)
  return { success: !error }
}
