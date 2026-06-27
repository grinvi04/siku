import { processPhoto } from '@/services/web/photoPipeline'
import { supabase } from './supabase'

export interface PhotoRow {
  id: string
  event_id: string
  uploader_id: string
  storage_path: string
  thumb_path: string
  taken_at: string | null
  lat: number | null
  lng: number | null
  visit_id: string | null
  size_bytes: number
  created_at: string
}

export interface PhotoWithUrl extends PhotoRow {
  thumbUrl: string
}

export async function listPhotos(eventId: string): Promise<PhotoWithUrl[]> {
  const { data, error } = await supabase
    .from('photos')
    .select('*')
    .eq('event_id', eventId)
    .order('taken_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })
  if (error) throw error
  if (data.length === 0) return []

  const { data: signed, error: signError } = await supabase.storage.from('photos').createSignedUrls(
    data.map((p) => p.thumb_path),
    60 * 60,
  )
  if (signError) throw signError
  const urlByPath = new Map(signed.map((s) => [s.path, s.signedUrl]))
  return data.map((p) => ({ ...p, thumbUrl: urlByPath.get(p.thumb_path) ?? '' }))
}

export async function getPhotoUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('photos')
    .createSignedUrl(storagePath, 60 * 60)
  if (error) throw error
  return data.signedUrl
}

function friendlyUploadError(e: unknown): string {
  const message = e instanceof Error ? e.message : String(e)
  if (/maximum allowed size|exceeded/i.test(message)) return '용량 초과'
  if (/mime|content.?type/i.test(message)) return '지원하지 않는 형식'
  if (/decod|변환/i.test(message)) return '이미지를 읽지 못함'
  return message.slice(0, 60)
}

/**
 * 사진들을 순차 업로드 (iOS 메모리 한계 — 동시 리사이즈 금지).
 * storage 업로드 성공 후 DB row를 만들고, row 생성이 실패하면 storage를 정리해 고아를 막는다.
 */
export async function uploadPhotos(
  groupId: string,
  eventId: string,
  files: File[],
  onProgress?: (done: number, total: number) => void,
): Promise<{ uploaded: number; failed: number; reasons: string[] }> {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) throw new Error('로그인이 필요합니다.')

  let uploaded = 0
  let failed = 0
  const reasons: string[] = []
  for (const file of files) {
    try {
      const processed = await processPhoto(file)
      const ext = processed.main.blob.type === 'image/webp' ? 'webp' : 'jpg'
      const id = crypto.randomUUID()
      const basePath = `${groupId}/${eventId}/${id}`
      const storagePath = `${basePath}.${ext}`
      const thumbPath = `${basePath}_thumb.${ext}`

      const { error: mainError } = await supabase.storage
        .from('photos')
        .upload(storagePath, processed.main.blob, { contentType: processed.main.blob.type })
      if (mainError) throw mainError
      const { error: thumbError } = await supabase.storage
        .from('photos')
        .upload(thumbPath, processed.thumb.blob, { contentType: processed.thumb.blob.type })
      if (thumbError) {
        await supabase.storage.from('photos').remove([storagePath])
        throw thumbError
      }

      const { error: rowError } = await supabase.from('photos').insert({
        id,
        event_id: eventId,
        uploader_id: auth.user.id,
        storage_path: storagePath,
        thumb_path: thumbPath,
        taken_at: processed.takenAt,
        lat: processed.lat,
        lng: processed.lng,
        size_bytes: processed.main.blob.size,
        width: processed.main.width,
        height: processed.main.height,
      })
      if (rowError) {
        await supabase.storage.from('photos').remove([storagePath, thumbPath])
        throw rowError
      }
      uploaded++
    } catch (e) {
      console.error('사진 업로드 실패:', file.name, e)
      failed++
      reasons.push(friendlyUploadError(e))
    }
    onProgress?.(uploaded + failed, files.length)
  }
  return { uploaded, failed, reasons }
}

export async function deletePhotos(photos: PhotoRow[]): Promise<void> {
  if (photos.length === 0) return
  const { error } = await supabase
    .from('photos')
    .delete()
    .in(
      'id',
      photos.map((p) => p.id),
    )
  if (error) throw error
  await supabase.storage
    .from('photos')
    .remove(photos.flatMap((p) => [p.storage_path, p.thumb_path]))
}
