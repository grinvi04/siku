import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { expect, test } from '@playwright/test'
import {
  admin,
  adminCreateEvent,
  adminCreateGroup,
  addMemberDirectly,
  ANON_KEY,
  cleanup,
  createTestUser,
  makePng,
  SUPABASE_URL,
  type TestUser,
} from './helpers/admin'

test.describe.configure({ mode: 'serial' })

let owner: TestUser
let member: TestUser
let outsider: TestUser
let groupId: string
let eventId: string
let ownerClient: SupabaseClient
let memberClient: SupabaseClient
let outsiderClient: SupabaseClient
const createdPaths: string[] = []

async function clientFor(user: TestUser): Promise<SupabaseClient> {
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error } = await client.auth.setSession({
    access_token: user.session.access_token,
    refresh_token: user.session.refresh_token,
  })
  if (error) throw error
  return client
}

async function addRealPhoto() {
  const id = crypto.randomUUID()
  const base = `${groupId}/${eventId}/${id}`
  const storagePath = `${base}.png`
  const thumbPath = `${base}_thumb.png`
  for (const path of [storagePath, thumbPath]) {
    const { error } = await ownerClient.storage.from('photos').upload(path, makePng(16), {
      contentType: 'image/png',
    })
    if (error) throw error
    createdPaths.push(path)
  }
  const { error } = await ownerClient.from('photos').insert({
    id,
    event_id: eventId,
    uploader_id: owner.id,
    storage_path: storagePath,
    thumb_path: thumbPath,
    size_bytes: 1024,
  })
  if (error) throw error
  return { id, storagePath, thumbPath }
}

async function assertStored(id: string, paths: string[], present: boolean) {
  const { data, error } = await admin.from('photos').select('id').eq('id', id)
  if (error) throw error
  expect(data).toHaveLength(present ? 1 : 0)
  for (const path of paths) {
    const { error: downloadError } = await admin.storage.from('photos').download(path)
    expect(downloadError === null).toBe(present)
  }
}

test.beforeAll(async () => {
  owner = await createTestUser('사진 업로더')
  member = await createTestUser('같은 모임 멤버')
  outsider = await createTestUser('다른 사용자')
  const group = await adminCreateGroup(owner.id, '사진 정책 E2E')
  groupId = group.id
  await addMemberDirectly(groupId, member.id)
  eventId = await adminCreateEvent(groupId, owner.id, '사진 정책 기록')
  ownerClient = await clientFor(owner)
  memberClient = await clientFor(member)
  outsiderClient = await clientFor(outsider)
})

test.afterAll(async () => {
  if (createdPaths.length > 0) await admin.storage.from('photos').remove(createdPaths)
  await cleanup([groupId].filter(Boolean), [owner?.id, member?.id, outsider?.id].filter(Boolean))
})

test('같은 모임 멤버는 타인 사진 행·파일을 지울 수 없고 업로더는 행→파일 순서로 지운다', async () => {
  const photo = await addRealPhoto()
  const paths = [photo.storagePath, photo.thumbPath]

  const rowAttempt = await memberClient.from('photos').delete().eq('id', photo.id).select('id')
  expect(rowAttempt.error).toBeNull()
  expect(rowAttempt.data).toEqual([])
  await memberClient.storage.from('photos').remove(paths)
  await assertStored(photo.id, paths, true)

  const rowDelete = await ownerClient.from('photos').delete().eq('id', photo.id).select('id')
  expect(rowDelete.error).toBeNull()
  expect(rowDelete.data).toHaveLength(1)
  const fileDelete = await ownerClient.storage.from('photos').remove(paths)
  expect(fileDelete.error).toBeNull()
  await assertStored(photo.id, paths, false)
})

test('DB 행 삭제 뒤 Storage 거부는 파일을 남긴다 — 두 작업은 원자적이지 않다', async () => {
  const photo = await addRealPhoto()
  const paths = [photo.storagePath, photo.thumbPath]

  const rowDelete = await ownerClient.from('photos').delete().eq('id', photo.id).select('id')
  expect(rowDelete.error).toBeNull()
  expect(rowDelete.data).toHaveLength(1)
  await outsiderClient.storage.from('photos').remove(paths)
  const { data, error } = await admin.from('photos').select('id').eq('id', photo.id)
  if (error) throw error
  expect(data).toHaveLength(0)
  for (const path of paths) {
    const { error: downloadError } = await admin.storage.from('photos').download(path)
    expect(downloadError).toBeNull()
  }
})
