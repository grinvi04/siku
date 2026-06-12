import { expect, test, type Page } from '@playwright/test'
import {
  addMemberDirectly,
  cleanup,
  createTestUser,
  STORAGE_KEY,
  type TestUser,
} from './helpers/admin'

// 핵심 정산 흐름 E2E — 실제 Supabase에 대해 식구 생성 → 기록 → 지출 → 정산 확정/취소까지.
// 테스트 사용자·데이터는 종료 시 정리된다.
// 두 테스트가 같은 식구 데이터를 공유하므로 직렬 실행 (병렬이면 워커가 갈라져 상태를 못 본다)
test.describe.configure({ mode: 'serial' })

let owner: TestUser
let friend: TestUser
const createdGroups: string[] = []

test.beforeAll(async () => {
  owner = await createTestUser('E2E 총무')
  friend = await createTestUser('E2E 친구')
})

test.afterAll(async () => {
  await cleanup(createdGroups, [owner?.id, friend?.id].filter(Boolean))
})

async function loginAs(page: Page, user: TestUser) {
  await page.addInitScript(
    ([key, session]) => localStorage.setItem(key, session),
    [STORAGE_KEY, JSON.stringify(user.session)] as const,
  )
}

test('식구 생성 → 기록 → 지출 → 정산 확정·취소 전 과정', async ({ page }) => {
  test.slow() // 실 네트워크 흐름

  await loginAs(page, owner)

  // 1. 식구 생성
  await page.goto('/')
  await page.getByRole('button', { name: '새 식구 만들기' }).click()
  await page.getByLabel('식구 이름').fill('E2E 검증 식구')
  await page.getByRole('button', { name: '식구 만들기' }).click()
  await expect(page.getByRole('heading', { name: 'E2E 검증 식구' })).toBeVisible()

  const groupId = page.url().match(/groups\/([0-9a-f-]+)/)?.[1]
  expect(groupId).toBeTruthy()
  createdGroups.push(groupId!)

  // 2. 두 번째 멤버 합류 (직접 등록 — 초대 흐름은 별도 테스트)
  await addMemberDirectly(groupId!, friend.id)

  // 3. 기록 생성 (멤버 전원 기본 참여 — 친구가 칩에 보이도록 새로고침)
  await page.reload()
  await page.getByRole('button', { name: '새 기록 남기기' }).click()
  await expect(page.getByText('E2E 친구')).toBeVisible() // 참여자 칩 로딩 대기
  await page.getByLabel('이름').fill('E2E 저녁')
  await page.getByRole('button', { name: '기록 남기기' }).click()
  await expect(page.getByRole('heading', { name: 'E2E 저녁' })).toBeVisible()

  // 4. 지출 입력: 총무가 90,000원 결제, 둘이 나눔
  await page.getByRole('button', { name: '지출 추가' }).click()
  await page.getByLabel('내용').fill('고기')
  await page.getByLabel('금액 (원)').fill('90000')
  await page.getByRole('button', { name: '추가', exact: true }).click()

  // 5. 정산 미리보기 — 돈 계산이 화면까지 정확한지
  await expect(page.getByText('90,000원').first()).toBeVisible() // 총액(+지출 행)
  await expect(page.getByText('+45,000원 받아요')).toBeVisible() // 총무
  await expect(page.getByText('-45,000원 보내요')).toBeVisible() // 친구
  await expect(page.getByText(/E2E 친구.*→.*E2E 총무/)).toBeVisible() // 이체 안내

  // 6. 정산 확정 → 잠금 확인
  await page.getByRole('button', { name: '정산 확정' }).click()
  await page.getByRole('dialog').getByRole('button', { name: '확정' }).click()
  await expect(page.getByText('송금 1건 중')).toBeVisible()
  await expect(page.getByText('정산이 확정되어 잠겨 있어요')).toBeVisible()
  await expect(page.getByRole('button', { name: '지출 추가' })).not.toBeVisible()

  // 7. 정산 취소 → 잠금 해제
  await page.getByRole('button', { name: '정산 취소' }).click()
  await page.getByRole('dialog').getByRole('button', { name: '정산 취소' }).click()
  await expect(page.getByRole('button', { name: '지출 추가' })).toBeVisible()
})

test('두 번째 멤버 시점: 같은 기록이 보이고 보낼 금액이 표시된다', async ({ page }) => {
  test.slow()
  test.skip(createdGroups.length === 0, '선행 테스트에서 식구가 만들어지지 않음')

  await loginAs(page, friend)
  await page.goto(`/groups/${createdGroups[0]}`)
  await page.getByRole('link', { name: /E2E 저녁/ }).click()
  await expect(page.getByText('-45,000원 보내요')).toBeVisible()
})
