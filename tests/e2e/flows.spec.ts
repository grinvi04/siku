import { expect, test, type Browser, type Page } from '@playwright/test'
import {
  admin,
  adminCreateEvent,
  adminCreateGroup,
  cleanup,
  createTestUser,
  makePng,
  STORAGE_KEY,
  type TestUser,
} from './helpers/admin'

// 초대 가입 · 송금 체크/되돌리기 · 사진 업로드/삭제 — 공유 픽스처라 직렬 실행
test.describe.configure({ mode: 'serial' })

let owner: TestUser
let friend: TestUser
let group: { id: string; invite_code: string }
let eventId: string

test.beforeAll(async () => {
  owner = await createTestUser('흐름 총무')
  friend = await createTestUser('흐름 친구')
  group = await adminCreateGroup(owner.id, 'E2E 흐름 식구')
  eventId = await adminCreateEvent(group.id, owner.id, 'E2E 흐름 저녁')
})

test.afterAll(async () => {
  await cleanup([group?.id].filter(Boolean), [owner?.id, friend?.id].filter(Boolean))
})

async function loginAs(target: Page, user: TestUser) {
  await target.addInitScript(
    ([key, session]) => localStorage.setItem(key, session),
    [STORAGE_KEY, JSON.stringify(user.session)] as const,
  )
}

async function newSessionPage(browser: Browser, user: TestUser): Promise<Page> {
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await loginAs(page, user)
  return page
}

test('초대 링크로 식구 되기', async ({ page }) => {
  test.slow()
  await loginAs(page, friend)
  await page.goto(`/invite/${group.invite_code}`)
  await expect(page.getByRole('heading', { name: 'E2E 흐름 식구' })).toBeVisible()
  await expect(page.getByText('1명이 함께 먹고 다니는 중이에요')).toBeVisible()
  await page.getByRole('button', { name: '식구 되기' }).click()
  // 가입 완료 → 식구 페이지, 멤버 칩에 본인 표시
  await expect(page.getByRole('heading', { name: 'E2E 흐름 식구' })).toBeVisible()
  await expect(page.getByText('흐름 친구')).toBeVisible()
})

test('송금 체크: 보냈어요 → 받았어요 → 되돌리기', async ({ page, browser }) => {
  test.slow()

  // 친구를 기록 참가자로 등록 (지출 폼의 칩은 '기록 참가자' 목록이다)
  const { error } = await admin
    .from('event_participants')
    .insert({ event_id: eventId, user_id: friend.id })
  if (error) throw error

  // 총무가 지출 입력 + 정산 확정
  await loginAs(page, owner)
  await page.goto(`/events/${eventId}`)
  await page.getByRole('button', { name: '지출 추가' }).click()
  await expect(page.getByRole('button', { name: '흐름 친구' }).first()).toBeVisible() // 칩 로딩(기본 전원 선택)
  await page.getByLabel('내용').fill('회식')
  await page.getByLabel('금액 (원)').fill('50000')
  await page.getByRole('button', { name: '추가', exact: true }).click()
  await expect(page.getByText('+25,000원 받아요')).toBeVisible()
  await page.getByRole('button', { name: '정산 확정' }).click()
  await page.getByRole('dialog').getByRole('button', { name: '확정' }).click()
  await expect(page.getByText('송금 1건 중')).toBeVisible()

  // 친구(보내는 사람) 세션: 보냈어요
  const friendPage = await newSessionPage(browser, friend)
  await friendPage.goto(`/events/${eventId}`)
  await friendPage.getByRole('button', { name: '보냈어요' }).click()
  await expect(friendPage.getByText('보냄', { exact: false }).first()).toBeVisible()

  // 총무(받는 사람): 받았어요 → 완료 + 진행 요약 갱신
  await page.reload()
  await page.getByRole('button', { name: '받았어요' }).click()
  await expect(page.getByText('1건 완료')).toBeVisible()

  // 받는 사람이 되돌리기 → 다시 '보냄' 상태로
  await page.getByRole('button', { name: '되돌리기' }).click()
  await expect(page.getByText('0건 완료')).toBeVisible()

  await friendPage.context().close()
})

test('사진 업로드 → 보기 → 삭제', async ({ page }) => {
  test.slow()
  await loginAs(page, owner)
  await page.goto(`/events/${eventId}`)
  await page.getByRole('button', { name: '사진' }).click()

  await page
    .locator('input[type="file"][multiple]')
    .setInputFiles({ name: 'e2e.png', mimeType: 'image/png', buffer: makePng(64) })
  await expect(page.getByText('사진 1장을 올렸어요')).toBeVisible({ timeout: 15_000 })

  // 그리드 → 크게 보기 → 삭제
  const thumb = page.locator('img[loading="lazy"]').first()
  await expect(thumb).toBeVisible()
  await thumb.click()
  await page.getByRole('button', { name: '지우기', exact: true }).click()
  await page
    .getByRole('dialog', { name: '사진을 지울까요?' })
    .getByRole('button', { name: '지우기' })
    .click()
  await expect(page.getByText('함께 찍은 사진을 올려보세요', { exact: false })).toBeVisible()
})
