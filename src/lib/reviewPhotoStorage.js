/**
 * Upload review photos to Supabase Storage (review-photos bucket).
 * React Native: accepts { uri } from expo-image-picker.
 *
 * Picker assets are often HEIC on iOS while the temp path ends in .jpg; uploading that
 * binary as image/jpeg breaks web and many Android img/Image decoders (gray tiles).
 * We normalize to real JPEG via expo-image-manipulator before upload.
 */

import { manipulateAsync, SaveFormat } from 'expo-image-manipulator'
import { supabase } from './supabase'

const BUCKET = 'review-photos'
const MAX_SIZE = 5 * 1024 * 1024 // 5MB

async function uriToJpegForUpload(uri) {
  const { uri: out } = await manipulateAsync(uri, [], {
    compress: 0.85,
    format: SaveFormat.JPEG,
  })
  return out
}

async function uriToBlob(uri) {
  const res = await fetch(uri)
  if (!res.ok) return null
  return res.blob()
}

export async function uploadReviewPhoto(photo, userId, reviewId, index) {
  if (!photo?.uri || !userId || reviewId == null) return null
  if (!supabase) return null
  let uploadUri = photo.uri
  try {
    uploadUri = await uriToJpegForUpload(photo.uri)
  } catch (e) {
    console.warn('[reviewPhotoStorage] JPEG normalize failed, uploading original uri', e)
  }
  const path = `${userId}/${reviewId}/${Date.now()}-${index}.jpg`
  const blob = await uriToBlob(uploadUri)
  if (!blob?.size) {
    console.warn('[reviewPhotoStorage] Empty or unreadable image blob')
    return null
  }
  if (blob.size > MAX_SIZE) {
    console.warn('[reviewPhotoStorage] File too large:', blob.size)
    return null
  }
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: 'image/jpeg', upsert: false })
  if (error) {
    console.warn('[reviewPhotoStorage] Upload error:', error.message || error)
    return null
  }
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
