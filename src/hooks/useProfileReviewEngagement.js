import { useState, useCallback, useMemo } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { getLikeCountsByReviewIds, getLikedReviewIds, likeReview, unlikeReview } from '../services/reviewLikes'
import { getCommentCountsByReviewIds } from '../services/reviewComments'

export function countFromMap(map, id) {
  if (!map || id == null) return 0
  if (map[id] != null) return map[id]
  const n = Number(id)
  if (!Number.isNaN(n) && map[n] != null) return map[n]
  return 0
}

export function likedFromSet(set, id) {
  if (!set || id == null) return false
  return set.has(String(id))
}

/**
 * Batch like/comment counts + liked state for profile review lists; refetches on focus.
 */
export function useProfileReviewEngagement(reviews, userId) {
  const reviewIds = useMemo(() => reviews.map((r) => r.venue_review_id).filter(Boolean), [reviews])

  const [likeCounts, setLikeCounts] = useState({})
  const [commentCounts, setCommentCounts] = useState({})
  const [likedIds, setLikedIds] = useState(() => new Set())
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!reviewIds.length) {
      setLikeCounts({})
      setCommentCounts({})
      setLikedIds(new Set())
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const [likesMap, commentsMap, liked] = await Promise.all([
        getLikeCountsByReviewIds(reviewIds),
        getCommentCountsByReviewIds(reviewIds),
        userId ? getLikedReviewIds(userId, reviewIds) : Promise.resolve(new Set()),
      ])
      setLikeCounts(likesMap || {})
      setCommentCounts(commentsMap || {})
      const raw = liked instanceof Set ? [...liked] : []
      setLikedIds(new Set(raw.map((x) => String(x))))
    } catch (e) {
      console.error('useProfileReviewEngagement', e)
    } finally {
      setLoading(false)
    }
  }, [reviewIds, userId])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load])
  )

  const toggleLike = useCallback(
    async (reviewId) => {
      if (!userId || reviewId == null) return
      const key = String(reviewId)
      let wasLiked = false
      setLikedIds((s) => {
        wasLiked = s.has(key)
        const next = new Set(s)
        if (wasLiked) next.delete(key)
        else next.add(key)
        return next
      })
      setLikeCounts((m) => {
        const prev = countFromMap(m, reviewId)
        return { ...m, [reviewId]: Math.max(0, prev + (wasLiked ? -1 : 1)) }
      })
      try {
        if (wasLiked) await unlikeReview(userId, reviewId)
        else await likeReview(userId, reviewId)
      } catch (e) {
        console.error(e)
        load()
      }
    },
    [userId, load]
  )

  return {
    engagementLoading: loading,
    likeCounts,
    commentCounts,
    likedIds,
    toggleLike,
    refreshEngagement: load,
    countFromMap,
    likedFromSet,
  }
}
