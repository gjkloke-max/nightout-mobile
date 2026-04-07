import { supabase } from '../lib/supabase'
import { enrichCommentsWithLikes } from './commentLikes'

function profilesByIdMap(rows) {
  const m = {}
  for (const p of rows || []) {
    if (!p?.id) continue
    m[p.id] = p
    m[String(p.id)] = p
  }
  return m
}

function authorFromProfiles(profilesById, userId) {
  if (userId == null || userId === '') return null
  return profilesById[userId] ?? profilesById[String(userId)] ?? null
}

function mentionProfilesForIds(ids, byId) {
  const out = []
  const seen = new Set()
  for (const raw of ids || []) {
    const id = raw != null ? String(raw) : ''
    if (!id || seen.has(id)) continue
    seen.add(id)
    const p = byId[id]
    if (p?.username) out.push({ id: p.id, username: p.username })
  }
  return out
}

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
      venue_review_id,
      venue_id,
      user_id,
      rating10,
      review_text,
      review_date,
      created_at,
      mentioned_user_ids,
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

  const commenterIds = new Set()
  const [profilesRes, likesRes, commentsRes, photosRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, first_name, last_name, avatar_url, username')
      .in('id', [...new Set((reviews || []).map((r) => r.user_id).filter(Boolean))]),
    supabase.from('review_likes').select('review_id, user_id').in('review_id', reviewIds),
    supabase
      .from('review_comments')
      .select('id, review_id, user_id, comment_text, created_at, parent_comment_id, mentioned_user_ids')
      .in('review_id', reviewIds)
      .order('created_at', { ascending: true }),
    supabase.from('review_photos').select('id, review_id, photo_url').in('review_id', reviewIds),
  ])

  ;(commentsRes.data || []).forEach((c) => commenterIds.add(c.user_id))
  const commenterProfiles = commenterIds.size
    ? await supabase.from('profiles').select('id, first_name, last_name, avatar_url, username').in('id', [...commenterIds])
    : { data: [] }
  const commenterById = profilesByIdMap(commenterProfiles.data)

  const mentionIdSet = new Set()
  for (const rv of reviews || []) {
    for (const mid of rv.mentioned_user_ids || []) mentionIdSet.add(String(mid))
  }
  for (const c of commentsRes.data || []) {
    for (const mid of c.mentioned_user_ids || []) mentionIdSet.add(String(mid))
  }
  let mentionById = {}
  if (mentionIdSet.size > 0) {
    const { data: mProf } = await supabase.from('profiles').select('id, username').in('id', [...mentionIdSet])
    mentionById = profilesByIdMap(mProf || [])
  }

  const profilesById = profilesByIdMap(profilesRes.data)
  const likesByReview = {}
  ;(likesRes.data || []).forEach((l) => {
    if (!likesByReview[l.review_id]) likesByReview[l.review_id] = []
    likesByReview[l.review_id].push(l.user_id)
  })
  const commentsByReview = {}
  ;(commentsRes.data || []).forEach((c) => {
    if (!commentsByReview[c.review_id]) commentsByReview[c.review_id] = []
    commentsByReview[c.review_id].push({
      ...c,
      profile: authorFromProfiles(commenterById, c.user_id),
      mentionProfiles: mentionProfilesForIds(c.mentioned_user_ids, mentionById),
    })
  })
  const photosByReview = {}
  ;(photosRes.data || []).forEach((p) => {
    if (!photosByReview[p.review_id]) photosByReview[p.review_id] = []
    photosByReview[p.review_id].push(p)
  })

  const out = []
  for (const r of reviews || []) {
    const venue = Array.isArray(r.venue) ? r.venue[0] : r.venue
    const uid = r.user_id
    const rawComments = commentsByReview[r.venue_review_id] || []
    const comments = await enrichCommentsWithLikes(rawComments, userId)
    out.push({
      ...r,
      venue,
      author: authorFromProfiles(profilesById, uid),
      mentionProfiles: mentionProfilesForIds(r.mentioned_user_ids, mentionById),
      likeCount: (likesByReview[r.venue_review_id] || []).length,
      likedBy: likesByReview[r.venue_review_id] || [],
      comments,
      photos: photosByReview[r.venue_review_id] || [],
    })
  }
  return out
}

export async function getSocialReviewById(userId, venueReviewId) {
  if (!userId || venueReviewId == null || !supabase) return null
  const id = Number(venueReviewId)
  if (!Number.isFinite(id)) return null

  const { data: following } = await supabase
    .from('user_follows')
    .select('followed_user_id')
    .eq('follower_user_id', userId)
  const followedIds = (following || []).map((r) => r.followed_user_id)
  const authorIds = [...new Set([userId, ...followedIds])]

  const { data: r, error } = await supabase
    .from('venue_review')
    .select(`
      venue_review_id,
      venue_id,
      user_id,
      rating10,
      review_text,
      review_date,
      created_at,
      mentioned_user_ids,
      venue:venue_id (venue_id, name, neighborhood_name, primary_photo_url)
    `)
    .eq('venue_review_id', id)
    .in('user_id', authorIds)
    .maybeSingle()

  if (error || !r) return null

  const reviewIds = [r.venue_review_id]
  const commenterIds = new Set()
  const [profilesRes, likesRes, commentsRes, photosRes] = await Promise.all([
    supabase.from('profiles').select('id, first_name, last_name, avatar_url, username').in('id', [r.user_id]),
    supabase.from('review_likes').select('review_id, user_id').in('review_id', reviewIds),
    supabase
      .from('review_comments')
      .select('id, review_id, user_id, comment_text, created_at, parent_comment_id, mentioned_user_ids')
      .in('review_id', reviewIds)
      .order('created_at', { ascending: true }),
    supabase.from('review_photos').select('id, review_id, photo_url').in('review_id', reviewIds),
  ])

  ;(commentsRes.data || []).forEach((c) => commenterIds.add(c.user_id))
  const commenterProfiles = commenterIds.size
    ? await supabase.from('profiles').select('id, first_name, last_name, avatar_url, username').in('id', [...commenterIds])
    : { data: [] }
  const commenterById = profilesByIdMap(commenterProfiles.data)

  const mentionIdSet = new Set()
  for (const mid of r.mentioned_user_ids || []) mentionIdSet.add(String(mid))
  for (const c of commentsRes.data || []) {
    for (const mid of c.mentioned_user_ids || []) mentionIdSet.add(String(mid))
  }
  let mentionById = {}
  if (mentionIdSet.size > 0) {
    const { data: mProf } = await supabase.from('profiles').select('id, username').in('id', [...mentionIdSet])
    mentionById = profilesByIdMap(mProf || [])
  }

  const profilesById = profilesByIdMap(profilesRes.data)
  const likesByReview = {}
  ;(likesRes.data || []).forEach((l) => {
    if (!likesByReview[l.review_id]) likesByReview[l.review_id] = []
    likesByReview[l.review_id].push(l.user_id)
  })
  const commentsByReview = {}
  ;(commentsRes.data || []).forEach((c) => {
    if (!commentsByReview[c.review_id]) commentsByReview[c.review_id] = []
    commentsByReview[c.review_id].push({
      ...c,
      profile: authorFromProfiles(commenterById, c.user_id),
      mentionProfiles: mentionProfilesForIds(c.mentioned_user_ids, mentionById),
    })
  })
  const photosByReview = {}
  ;(photosRes.data || []).forEach((p) => {
    if (!photosByReview[p.review_id]) photosByReview[p.review_id] = []
    photosByReview[p.review_id].push(p)
  })

  const venue = Array.isArray(r.venue) ? r.venue[0] : r.venue
  const rawComments = commentsByReview[r.venue_review_id] || []
  const comments = await enrichCommentsWithLikes(rawComments, userId)
  return {
    ...r,
    venue,
    author: authorFromProfiles(profilesById, r.user_id),
    mentionProfiles: mentionProfilesForIds(r.mentioned_user_ids, mentionById),
    likeCount: (likesByReview[r.venue_review_id] || []).length,
    likedBy: likesByReview[r.venue_review_id] || [],
    comments,
    photos: photosByReview[r.venue_review_id] || [],
  }
}
