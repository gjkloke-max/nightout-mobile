/**
 * Profile avatar upload/remove — same bucket/paths as web (avatars/{userId}/avatar.ext)
 *
 * React Native: fetch(localUri).blob() is unreliable; we normalize to JPEG via
 * expo-image-manipulator and upload raw bytes (Supabase RN guidance).
 */

import * as ImagePicker from 'expo-image-picker'
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator'
import { supabase } from '../lib/supabase'

const BUCKET = 'avatars'

function base64ToUint8Array(base64) {
  const binaryString = atob(base64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes
}

/**
 * @param {string} userId
 * @param {string} uri - local file URI from ImagePicker
 * @param {string} [_mimeType] - ignored; output is always JPEG after manipulation
 * @returns {Promise<{ success: boolean, avatarUrl?: string, error?: string }>}
 */
export async function uploadAvatarFromUri(userId, uri, _mimeType = 'image/jpeg') {
  if (!supabase || !userId || !uri) return { success: false, error: 'Invalid input' }

  const path = `${userId}/avatar.jpg`
  const contentType = 'image/jpeg'

  try {
    const manipulated = await manipulateAsync(
      uri,
      [{ resize: { width: 1024 } }],
      { compress: 0.85, format: SaveFormat.JPEG, base64: true }
    )

    if (!manipulated.base64) {
      return { success: false, error: 'Could not read image data' }
    }

    const bytes = base64ToUint8Array(manipulated.base64)

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, bytes, { upsert: true, contentType })

    if (uploadError) return { success: false, error: uploadError.message }

    const {
      data: { publicUrl },
    } = supabase.storage.from(BUCKET).getPublicUrl(path)
    const url = `${publicUrl}?t=${Date.now()}`

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: url, updated_at: new Date().toISOString() })
      .eq('id', userId)

    if (updateError) return { success: false, error: updateError.message }
    return { success: true, avatarUrl: url }
  } catch (e) {
    return { success: false, error: e?.message || 'Upload failed' }
  }
}

/**
 * Opens the photo library and uploads the selected image as the user’s avatar.
 * @returns {Promise<{ success: boolean, avatarUrl?: string, error?: string }>}
 *   `error` may be `PERMISSION_DENIED`, `CANCELLED`, or a message string.
 */
export async function pickAndUploadProfileAvatar(userId) {
  if (!userId) return { success: false, error: 'Invalid input' }
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (!perm.granted) return { success: false, error: 'PERMISSION_DENIED' }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.85,
  })
  if (result.canceled || !result.assets?.[0]?.uri) {
    return { success: false, error: 'CANCELLED' }
  }
  const asset = result.assets[0]
  const mime = asset.mimeType || 'image/jpeg'
  return uploadAvatarFromUri(userId, asset.uri, mime)
}

export async function removeAvatar(userId) {
  if (!supabase || !userId) return { success: false, error: 'Invalid input' }
  const { data: files } = await supabase.storage.from(BUCKET).list(userId)
  if (files?.length) {
    const paths = files.map((f) => `${userId}/${f.name}`)
    await supabase.storage.from(BUCKET).remove(paths)
  }
  const { error } = await supabase
    .from('profiles')
    .update({ avatar_url: null, updated_at: new Date().toISOString() })
    .eq('id', userId)
  if (error) return { success: false, error: error.message }
  return { success: true }
}
