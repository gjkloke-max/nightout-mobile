import { supabase } from '../lib/supabase'

export async function likeReview(userId, reviewId) {
  if (!userId || !reviewId || !supabase) return { success: false, error: 'Invalid' }
  const { error } = await supabase.from('review_likes').insert({ user_id: userId, review_id: reviewId })
  return { success: !error, error: error?.message }
}

export async function unlikeReview(userId, reviewId) {
  if (!userId || !reviewId || !supabase) return { success: false, error: 'Invalid' }
  const { error } = await supabase
    .from('review_likes')
    .delete()
    .eq('user_id', userId)
    .eq('review_id', reviewId)
  return { success: !error, error: error?.message }
}
