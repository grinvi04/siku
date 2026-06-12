import { createClient, type Session } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { deflateSync } from 'node:zlib'

// Playwright는 .env를 자동 로드하지 않으므로 직접 읽는다 (테스트 전용, repo 미포함 파일)
function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {}
  const raw = readFileSync(resolve(import.meta.dirname, '../../../.env'), 'utf8')
  for (const line of raw.split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/)
    if (m) env[m[1]] = m[2].trim()
  }
  return env
}

const env = loadEnv()
export const SUPABASE_URL = env.VITE_SUPABASE_URL
const ANON_KEY = env.VITE_SUPABASE_ANON_KEY
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY

if (!SERVICE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY가 .env에 없습니다 — 인증 E2E를 건너뜁니다.')
}

export const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

/** supabase-js가 세션을 저장하는 localStorage 키 */
export const STORAGE_KEY = `sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token`

export interface TestUser {
  id: string
  email: string
  session: Session
}

/** 메일 발송 없이 테스트 사용자 생성 + 프로필 + 세션 발급 */
export async function createTestUser(displayName: string): Promise<TestUser> {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@siku-e2e.test`

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
  })
  if (createError) throw createError
  const userId = created.user.id

  const { error: profileError } = await admin
    .from('profiles')
    .insert({ id: userId, display_name: displayName })
  if (profileError) throw profileError

  // 매직링크 토큰을 발급받아 즉시 검증 → 세션 (메일 불필요)
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })
  if (linkError) throw linkError

  const anon = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: verified, error: verifyError } = await anon.auth.verifyOtp({
    type: 'magiclink',
    token_hash: link.properties.hashed_token,
  })
  if (verifyError || !verified.session) throw verifyError ?? new Error('세션 발급 실패')

  return { id: userId, email, session: verified.session }
}

/** UI를 거치지 않는 픽스처용 식구 생성 (소유자 포함) */
export async function adminCreateGroup(
  ownerId: string,
  name: string,
): Promise<{ id: string; invite_code: string }> {
  const { data, error } = await admin
    .from('groups')
    .insert({ name, created_by: ownerId })
    .select('id, invite_code')
    .single()
  if (error) throw error
  const { error: memberError } = await admin
    .from('group_members')
    .insert({ group_id: data.id, user_id: ownerId, role: 'owner' })
  if (memberError) throw memberError
  return data
}

/** 픽스처용 기록 생성 (참가자 = 소유자) */
export async function adminCreateEvent(
  groupId: string,
  ownerId: string,
  title: string,
): Promise<string> {
  const { data, error } = await admin
    .from('events')
    .insert({
      group_id: groupId,
      title,
      type: 'dinner',
      starts_at: new Date().toISOString(),
      created_by: ownerId,
    })
    .select('id')
    .single()
  if (error) throw error
  const { error: pError } = await admin
    .from('event_participants')
    .insert({ event_id: data.id, user_id: ownerId })
  if (pError) throw pError
  return data.id
}

/** 업로드 테스트용 단색 PNG (의존성 없이 생성) */
export function makePng(size = 64, rgb: [number, number, number] = [42, 91, 215]): Buffer {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    return c >>> 0
  })
  const crc = (buf: Buffer) => {
    let r = 0xffffffff
    for (const b of buf) r = crcTable[(r ^ b) & 0xff] ^ (r >>> 8)
    return (r ^ 0xffffffff) >>> 0
  }
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const td = Buffer.concat([Buffer.from(type), data])
    const c = Buffer.alloc(4)
    c.writeUInt32BE(crc(td))
    return Buffer.concat([len, td, c])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(size * 3)])
  for (let x = 0; x < size; x++) {
    row[1 + x * 3] = rgb[0]
    row[2 + x * 3] = rgb[1]
    row[3 + x * 3] = rgb[2]
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(Array(size).fill(row)))),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/** 장소 인식 테스트용 사진 행 (파일 없이 좌표·시각만) */
export async function adminAddPhoto(
  eventId: string,
  uploaderId: string,
  lat: number,
  lng: number,
  takenAt: string,
): Promise<void> {
  const fake = `e2e/${eventId}/${Math.random().toString(36).slice(2)}`
  const { error } = await admin.from('photos').insert({
    event_id: eventId,
    uploader_id: uploaderId,
    storage_path: `${fake}.webp`,
    thumb_path: `${fake}_thumb.webp`,
    taken_at: takenAt,
    lat,
    lng,
    size_bytes: 1000,
  })
  if (error) throw error
}

export async function addMemberDirectly(groupId: string, userId: string): Promise<void> {
  const { error } = await admin
    .from('group_members')
    .insert({ group_id: groupId, user_id: userId, role: 'member' })
  if (error) throw error
}

/** 테스트가 만든 데이터 정리 — 실DB를 더럽히지 않는다 */
export async function cleanup(groupIds: string[], userIds: string[]): Promise<void> {
  if (groupIds.length > 0) {
    // 확정된 정산이 있으면 잠금 트리거가 cascade 삭제를 막으므로 먼저 해제
    const { data: events } = await admin.from('events').select('id').in('group_id', groupIds)
    const eventIds = (events ?? []).map((e) => e.id)
    if (eventIds.length > 0) {
      await admin
        .from('settlements')
        .update({ status: 'reopened' })
        .in('event_id', eventIds)
        .eq('status', 'closed')
    }
    await admin.from('groups').delete().in('id', groupIds)
  }
  for (const id of userIds) {
    await admin.auth.admin.deleteUser(id)
  }
}
