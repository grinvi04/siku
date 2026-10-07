import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { expect, test, type Page } from '@playwright/test'
import {
  admin,
  adminCreateEvent,
  adminCreateGroup,
  addMemberDirectly,
  ANON_KEY,
  cleanup,
  createTestUser,
  STORAGE_KEY,
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
// 제품 bucket이 허용하는 실제 WebP 2×2 이미지 (Chromium Canvas로 생성).
const photoBytes = Buffer.from(
  'UklGRhwCAABXRUJQVlA4WAoAAAAgAAAAAQAAAQAASUNDUMgBAAAAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADZWUDggLgAAANABAJ0BKgIAAgABQCYloAJ0ugH4AAOwAP7wG9//aWfqWfqWf48v/kFywuuIwAA=',
  'base64',
)

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

async function login(page: Page, user: TestUser) {
  await page.addInitScript(
    ([key, session]) => localStorage.setItem(key, session),
    [STORAGE_KEY, JSON.stringify(user.session)],
  )
}

async function addRealPhoto(forEventId = eventId) {
  const id = crypto.randomUUID()
  const base = `${groupId}/${forEventId}/${id}`
  const storagePath = `${base}.webp`
  const thumbPath = `${base}_thumb.webp`
  for (const path of [storagePath, thumbPath]) {
    const { error } = await ownerClient.storage.from('photos').upload(path, photoBytes, {
      contentType: 'image/webp',
    })
    if (error) throw error
    createdPaths.push(path)
  }
  const { error } = await ownerClient.from('photos').insert({
    id,
    event_id: forEventId,
    uploader_id: owner.id,
    storage_path: storagePath,
    thumb_path: thumbPath,
    size_bytes: photoBytes.length,
  })
  if (error) throw error
  return { id, storagePath, thumbPath }
}

async function assertStored(
  id: string,
  paths: string[],
  rowPresent: boolean,
  filesPresent = rowPresent,
) {
  const { data, error } = await admin.from('photos').select('id').eq('id', id)
  if (error) throw error
  expect(data).toHaveLength(rowPresent ? 1 : 0)
  for (const path of paths) {
    const { error: downloadError } = await admin.storage.from('photos').download(path)
    expect(downloadError === null).toBe(filesPresent)
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

test('실제 deletePhotos 함수는 타인 사진 0행 삭제 뒤 Storage를 건드리지 않는다', async ({
  page,
}) => {
  const photo = await addRealPhoto()
  const paths = [photo.storagePath, photo.thumbPath]
  await login(page, member)
  await page.goto(`/events/${eventId}`)

  let storageDeletes = 0
  await page.route('**/storage/v1/object/photos', (route) => {
    if (route.request().method() === 'DELETE') storageDeletes++
    return route.continue()
  })
  const result = await page.evaluate(async (input) => {
    const modulePath = '/src/data/photos.ts'
    const { deletePhotos } = await import(modulePath)
    try {
      await deletePhotos([
        { id: input.id, storage_path: input.storagePath, thumb_path: input.thumbPath },
      ])
      return 'success'
    } catch (error) {
      return error instanceof Error ? error.message : String(error)
    }
  }, photo)

  expect(result).toBe('PHOTO_DELETE_DENIED')
  expect(storageDeletes).toBe(0)
  await assertStored(photo.id, paths, true)
})

test('실제 deleteEvent 함수는 권한 없는 기록 0행 삭제 뒤 사진 파일을 보존한다', async ({
  page,
}) => {
  const protectedEventId = await adminCreateEvent(groupId, owner.id, '삭제 거부 기록')
  const photo = await addRealPhoto(protectedEventId)
  const paths = [photo.storagePath, photo.thumbPath]
  await login(page, member)
  await page.goto(`/events/${protectedEventId}`)

  let storageDeletes = 0
  await page.route('**/storage/v1/object/photos', (route) => {
    if (route.request().method() === 'DELETE') storageDeletes++
    return route.continue()
  })
  const result = await page.evaluate(async (id) => {
    const modulePath = '/src/data/events.ts'
    const { deleteEvent } = await import(modulePath)
    try {
      await deleteEvent(id)
      return 'success'
    } catch (error) {
      return error instanceof Error ? error.message : String(error)
    }
  }, protectedEventId)

  expect(result).toBe('EVENT_DELETE_DENIED')
  expect(storageDeletes).toBe(0)
  const { data: eventRows, error } = await admin
    .from('events')
    .select('id')
    .eq('id', protectedEventId)
  if (error) throw error
  expect(eventRows).toHaveLength(1)
  await assertStored(photo.id, paths, true)
})

test('실제 deleteEvent 함수는 허용된 기록과 사진 파일을 지운다', async ({ page }) => {
  const allowedEventId = await adminCreateEvent(groupId, owner.id, '삭제 허용 기록')
  const photo = await addRealPhoto(allowedEventId)
  const paths = [photo.storagePath, photo.thumbPath]
  await login(page, owner)
  await page.goto(`/events/${allowedEventId}`)

  const result = await page.evaluate(async (id) => {
    const modulePath = '/src/data/events.ts'
    const { deleteEvent } = await import(modulePath)
    try {
      await deleteEvent(id)
      return 'success'
    } catch (error) {
      return error instanceof Error ? error.message : String(error)
    }
  }, allowedEventId)

  expect(result).toBe('success')
  const { data: eventRows, error } = await admin
    .from('events')
    .select('id')
    .eq('id', allowedEventId)
  if (error) throw error
  expect(eventRows).toHaveLength(0)
  await assertStored(photo.id, paths, false)
})

test('사진 삭제 UI는 파일 정리 실패를 부분 실패로 알리고 삭제된 행을 숨긴다', async ({ page }) => {
  const partialEventId = await adminCreateEvent(groupId, owner.id, '사진 부분 삭제 기록')
  const photo = await addRealPhoto(partialEventId)
  const paths = [photo.storagePath, photo.thumbPath]
  await login(page, owner)
  await page.goto(`/events/${partialEventId}`)
  await page.getByRole('button', { name: '사진' }).click()
  await expect(page.locator('div.grid.grid-cols-3 > button')).toHaveCount(1)

  let storageDeletes = 0
  await page.route('**/storage/v1/object/photos', (route) => {
    if (route.request().method() !== 'DELETE') return route.continue()
    storageDeletes++
    return route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({ statusCode: 403, error: 'Forbidden', message: 'Storage denied' }),
    })
  })
  await page.locator('div.grid.grid-cols-3 > button').click()
  await page
    .getByRole('dialog', { name: '사진 보기' })
    .getByRole('button', { name: '지우기' })
    .click()
  await page
    .getByRole('dialog', { name: '사진을 지울까요?' })
    .getByRole('button', { name: '지우기' })
    .click()

  await expect(page.getByRole('status')).toHaveText(
    '사진 정보 1장은 지워졌지만 파일 정리에 실패했어요',
  )
  await expect(page.getByText('함께 찍은 사진을 올려보세요', { exact: false })).toBeVisible()
  expect(storageDeletes).toBe(1)
  await assertStored(photo.id, paths, false, true)
})

test('기록 삭제 UI는 파일 정리 실패 뒤 그룹으로 이동하고 삭제 사실을 알린다', async ({ page }) => {
  const partialEventId = await adminCreateEvent(groupId, owner.id, '부분 삭제 기록')
  const photo = await addRealPhoto(partialEventId)
  const paths = [photo.storagePath, photo.thumbPath]
  await login(page, owner)
  await page.goto(`/events/${partialEventId}`)

  let storageDeletes = 0
  await page.route('**/storage/v1/object/photos', (route) => {
    if (route.request().method() !== 'DELETE') return route.continue()
    storageDeletes++
    return route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({ statusCode: 403, error: 'Forbidden', message: 'Storage denied' }),
    })
  })
  await page.getByRole('button', { name: '이 기록 지우기' }).click()
  await page
    .getByRole('dialog', { name: '기록을 지울까요?' })
    .getByRole('button', { name: '지우기' })
    .click()

  await expect(page).toHaveURL(new RegExp(`/groups/${groupId}$`))
  await expect(page.getByRole('status')).toHaveText('기록은 지워졌지만 사진 파일 정리에 실패했어요')
  expect(storageDeletes).toBe(1)
  const { data: eventRows, error } = await admin
    .from('events')
    .select('id')
    .eq('id', partialEventId)
  if (error) throw error
  expect(eventRows).toHaveLength(0)
  await assertStored(photo.id, paths, false, true)
})
