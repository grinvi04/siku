import { expect, test, type Browser, type Page } from '@playwright/test'
import {
  admin,
  adminAddPhoto,
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
  await target.addInitScript(([key, session]) => localStorage.setItem(key, session), [
    STORAGE_KEY,
    JSON.stringify(user.session),
  ] as const)
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

test('기록 수정: 이름과 종류를 바꾼다', async ({ page }) => {
  test.slow()
  await loginAs(page, owner)
  await page.goto(`/events/${eventId}`)
  await page.getByRole('button', { name: '수정' }).click()
  await page.getByLabel('이름').fill('E2E 수정된 저녁')
  await page.getByRole('button', { name: '간식·카페' }).click()
  await page.getByRole('button', { name: '저장' }).click()
  await expect(page.getByRole('heading', { name: 'E2E 수정된 저녁' })).toBeVisible()
  await expect(page.getByText('간식·카페')).toBeVisible()
})

test('장소 자동 인식: 사진 좌표로 후보 → 이름 붙여 확정', async ({ page }) => {
  test.slow()
  // 같은 자리(시청 부근)에서 20분 간격 사진 2장
  const day = new Date().toISOString().slice(0, 10)
  await adminAddPhoto(eventId, owner.id, 37.5663, 126.9779, `${day}T10:00:00Z`)
  await adminAddPhoto(eventId, owner.id, 37.5664, 126.978, `${day}T10:20:00Z`)

  await loginAs(page, owner)
  await page.goto(`/events/${eventId}`)
  await page.getByRole('button', { name: '다녀온 곳' }).click()
  await page.getByRole('button', { name: '사진으로 다녀온 곳 찾기' }).click()
  await expect(page.getByText('여기 머물렀나요?')).toBeVisible()
  await expect(page.getByText(/· 사진 2장/)).toBeVisible()
  await page.getByPlaceholder('장소 이름 (예: ○○식당, △△해변)').fill('한강공원')
  await page.getByRole('button', { name: '맞아요' }).click()
  await expect(page.getByText('다녀온 곳에 추가했어요')).toBeVisible()
  await expect(page.getByText('한강공원')).toBeVisible()
})

test('영수증 자동 입력(OCR 모킹): 내용·금액이 채워진다', async ({ page }) => {
  test.slow()
  await loginAs(page, owner)
  await page.goto(`/events/${eventId}`)

  // 송금 테스트가 확정해 둔 정산을 풀어야 지출 추가가 열린다
  await page.getByRole('button', { name: '정산 취소' }).click()
  await page.getByRole('dialog').getByRole('button', { name: '정산 취소' }).click()

  // Vision Edge Function 응답을 가로채 흉내 — 외부 비용·비결정성 차단
  await page.route('**/functions/v1/parse-receipt', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ text: '맛나식당\n김치찌개 2\n합계 10,000\n2026-06-12' }),
    }),
  )

  await page.getByRole('button', { name: '지출 추가' }).click()
  await page
    .locator('input[type="file"][capture]')
    .setInputFiles({ name: 'receipt.png', mimeType: 'image/png', buffer: makePng(32) })
  await expect(page.getByText('영수증을 읽었어요', { exact: false })).toBeVisible()
  await expect(page.getByLabel('내용')).toHaveValue('맛나식당')
  await expect(page.getByLabel('금액 (원)')).toHaveValue('10000')
  await page.getByRole('button', { name: '추가', exact: true }).click()
  await expect(page.getByText('맛나식당')).toBeVisible()
})

test('통계 화면: 요약 카드와 참석왕', async ({ page }) => {
  test.slow()
  await loginAs(page, owner)
  await page.goto(`/groups/${group.id}/stats`)
  await expect(page.getByText('모임 횟수')).toBeVisible()
  await expect(page.getByText('총 지출')).toBeVisible()
  await expect(page.getByText('60,000원')).toBeVisible() // 50,000 + 10,000
  await expect(page.getByText('참석왕')).toBeVisible()
  await expect(page.getByText('흐름 총무')).toBeVisible()
})

test('기록 삭제: 만든 사람이 지우면 목록에서 사라진다', async ({ page }) => {
  test.slow()
  await loginAs(page, owner)
  await page.goto(`/events/${eventId}`)
  await page.getByRole('button', { name: '이 기록 지우기' }).click()
  await page
    .getByRole('dialog', { name: '기록을 지울까요?' })
    .getByRole('button', { name: '지우기' })
    .click()
  await expect(page.getByRole('heading', { name: 'E2E 흐름 식구' })).toBeVisible()
  await expect(page.getByText('E2E 수정된 저녁')).not.toBeVisible()
})
