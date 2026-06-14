import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  // CI에서 재시도 — session 의존 렌더(예: EventPage isCreator) 등 브라우저 비동기 레이스로
  // 드물게 요소가 제때 안 잡히는 경우를 흡수. 로컬은 0으로 실제 실패를 그대로 노출.
  retries: process.env.CI ? 2 : 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  projects: [
    // 주 사용 환경 기준 — 모바일 뷰포트
    { name: 'mobile-chromium', use: { ...devices['iPhone 12'], defaultBrowserType: 'chromium' } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 30_000,
  },
})
