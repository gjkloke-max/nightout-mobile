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
/** Must stay at or under storage.buckets.file_size_limit for review-photos (see migrations). */
const MAX_SIZE = 10 * 1024 * 1024 // 10MB

async function uriToJpegForUpload(uri) {
  const { uri: out } = await manipulateAsync(uri, [], {
    compress: 0.85,
    format: SaveFormat.JPEG,
  })
  return out
}

/**
 * Read file bytes for upload. Must use ArrayBuffer (not Blob) with Supabase on React Native:
 * storage-js wraps Blob in FormData, which often drops/corrupts the body on RN → empty objects → gray images.
 */
async function uriToArrayBuffer(uri) {
  const res = await fetch(uri)
  if (!res.ok) return null
  return res.arrayBuffer()
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
  const buf = await uriToArrayBuffer(uploadUri)
  if (!buf || buf.byteLength === 0) {
    console.warn('[reviewPhotoStorage] Empty or unreadable image bytes')
    return null
  }
  if (buf.byteLength > MAX_SIZE) {
    console.warn('[reviewPhotoStorage] File too large:', buf.byteLength)
    return null
  }
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buf, { contentType: 'image/jpeg', upsert: false })
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
