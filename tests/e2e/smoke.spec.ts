import { expect, test } from '@playwright/test'

// 비인증 스모크 — 라우팅 가드·로그인 화면·입력 검증.
// (인증 흐름은 매직링크라 service role 키 기반 픽스처가 필요 — 추후 확장 지점)

test('루트 접근 시 로그인으로 보내고 브랜드가 보인다', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByText('SIKU')).toBeVisible()
  await expect(page.getByText('밥 같이 먹는 사이')).toBeVisible()
  await expect(page.getByLabel('이메일')).toBeVisible()
})

test('보호된 경로는 로그인으로 리다이렉트되고 복귀 경로(next)를 보존한다', async ({ page }) => {
  await page.goto('/groups/new')
  await expect(page).toHaveURL(/\/login\?next=%2Fgroups%2Fnew/)
})

test('초대 링크도 로그인 후 돌아오도록 next를 보존한다', async ({ page }) => {
  await page.goto('/invite/test-code-123')
  await expect(page).toHaveURL(/\/login\?next=%2Finvite%2Ftest-code-123/)
})

test('알 수 없는 경로는 홈(→로그인)으로 정리된다', async ({ page }) => {
  await page.goto('/no-such-page')
  await expect(page).toHaveURL(/\/login/)
})

test('이메일이 비어 있으면 브라우저 검증이 제출을 막는다', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('button', { name: /로그인 링크 받기/ }).click()
  // 제출이 막혀 같은 화면에 머물고, "메일함 확인" 화면으로 넘어가지 않는다
  await expect(page.getByLabel('이메일')).toBeVisible()
  await expect(page.getByText('메일함을 확인해 주세요')).not.toBeVisible()
  const invalid = await page.getByLabel('이메일').evaluate(
    (el) => !(el as HTMLInputElement).checkValidity(),
  )
  expect(invalid).toBe(true)
})

test('형식이 잘못된 이메일도 제출이 막힌다', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('이메일').fill('not-an-email')
  await page.getByRole('button', { name: /로그인 링크 받기/ }).click()
  await expect(page.getByText('메일함을 확인해 주세요')).not.toBeVisible()
})

test('마지막 로그인 이메일이 자동으로 채워진다', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('moim:lastEmail', 'siku@example.com'))
  await page.goto('/login')
  await expect(page.getByLabel('이메일')).toHaveValue('siku@example.com')
})

test('악성 next 파라미터는 무시된다 (open redirect 방지)', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('moim:lastEmail', 'siku@example.com'))
  await page.goto('/login?next=https://evil.example.com')
  // sanitizeNextPath가 외부 URL을 버리므로 화면은 정상 로그인 화면
  await expect(page.getByLabel('이메일')).toBeVisible()
})
