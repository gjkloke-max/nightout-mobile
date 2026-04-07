import { supabase } from '../lib/supabase'
import { onVenueReviewMentioned } from './notificationHandlers'

export async function notifyNewVenueReviewMentions({ actorUserId, reviewId, newRecipientIds }) {
  if (!actorUserId || reviewId == null || !newRecipientIds?.length) return
  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name, last_name')
    .eq('id', actorUserId)
    .maybeSingle()
  const actorName = profile ? [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim() : ''

  for (const uid of new Set(newRecipientIds)) {
    if (!uid || String(uid) === String(actorUserId)) continue
    try {
      await onVenueReviewMentioned({
        recipientUserId: uid,
        actorUserId,
        reviewId,
        actorName: actorName || undefined,
      })
    } catch (e) {
      console.error('notifyNewVenueReviewMentions', e)
    }
  }
}
