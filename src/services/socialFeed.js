import { supabase } from '../lib/supabase'

export async function getSocialFeed(userId, limit = 30) {
  if (!userId || !supabase) return []
  const { data: following } = await supabase
    .from('user_follows')
    .select('followed_user_id')
    .eq('follower_user_id', userId)
  const followedIds = (following || []).map((r) => r.followed_user_id)
  const authorIds = [...new Set([userId, ...followedIds])]

  const { data: reviews, error } = await supabase
    .from('venue_review')
    .select(`
      venue_review_id, venue_id, user_id, rating10, review_text, review_date, created_at,
      venue:venue_id (venue_id, name, neighborhood_name, primary_photo_url)
    `)
    .in('user_id', authorIds)
    .not('user_id', 'is', null)
    .order('review_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return []
  const reviewIds = (reviews || []).map((r) => r.venue_review_id)
  if (reviewIds.length === 0) return []

  const [profilesRes, likesRes, commentsRes, photosRes] = await Promise.all([
    supabase.from('profiles').select('id, first_name, last_name, avatar_url').in('id', [...new Set((reviews || []).map((r) => r.user_id).filter(Boolean))]),
    supabase.from('review_likes').select('review_id, user_id').in('review_id', reviewIds),
    supabase.from('review_comments').select('id, review_id, user_id, comment_text, created_at').in('review_id', reviewIds).order('created_at', { ascending: true }),
    supabase.from('review_photos').select('id, review_id, photo_url').in('review_id', reviewIds),
  ])

  const profilesById = Object.fromEntries((profilesRes.data || []).map((p) => [p.id, p]))
  const likesByReview = {}
  ;(likesRes.data || []).forEach((l) => {
    if (!likesByReview[l.review_id]) likesByReview[l.review_id] = []
    likesByReview[l.review_id].push(l.user_id)
  })
  const commentsByReview = {}
  ;(commentsRes.data || []).forEach((c) => {
    if (!commentsByReview[c.review_id]) commentsByReview[c.review_id] = []
    commentsByReview[c.review_id].push({ ...c, profile: profilesById[c.user_id] || null })
  })
  const photosByReview = {}
  ;(photosRes.data || []).forEach((p) => {
    if (!photosByReview[p.review_id]) photosByReview[p.review_id] = []
    photosByReview[p.review_id].push(p)
  })

  return (reviews || []).map((r) => {
    const venue = Array.isArray(r.venue) ? r.venue[0] : r.venue
    return {
      ...r,
      venue,
      author: profilesById[r.user_id] || null,
      likeCount: (likesByReview[r.venue_review_id] || []).length,
      likedBy: likesByReview[r.venue_review_id] || [],
      comments: commentsByReview[r.venue_review_id] || [],
      photos: photosByReview[r.venue_review_id] || [],
    }
  })
}
