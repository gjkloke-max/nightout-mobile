/**
 * Upload review photos to Supabase Storage (review-photos bucket).
 * React Native: accepts { uri } from expo-image-picker.
 */

import { supabase } from './supabase'

const BUCKET = 'review-photos'
const MAX_SIZE = 5 * 1024 * 1024 // 5MB

function getExt(uri) {
  if (!uri) return 'jpg'
  const m = uri.match(/\.(jpe?g|png|webp)$/i)
  return m ? m[1].toLowerCase().replace('jpeg', 'jpg') : 'jpg'
}

async function uriToBlob(uri) {
  const res = await fetch(uri)
  return res.blob()
}

export async function uploadReviewPhoto(photo, userId, reviewId, index) {
  if (!photo?.uri || !userId || reviewId == null) return null
  if (!supabase) return null
  const ext = getExt(photo.uri)
  const contentType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg'
  const path = `${userId}/${reviewId}/${Date.now()}-${index}.${ext}`
  const blob = await uriToBlob(photo.uri)
  if (blob.size > MAX_SIZE) return null
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType, upsert: false })
  if (error) return null
  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(data.path)
  return urlData?.publicUrl || null
}

export async function uploadReviewPhotos(photos, userId, reviewId) {
  if (!Array.isArray(photos) || photos.length === 0 || !userId || reviewId == null) return []
  const results = await Promise.all(
    photos.map((p, i) => uploadReviewPhoto(p, userId, reviewId, i))
  )
  return results.filter(Boolean)
}
