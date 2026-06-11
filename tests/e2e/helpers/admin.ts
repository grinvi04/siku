import { createClient, type Session } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

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

export async function addMemberDirectly(groupId: string, userId: string): Promise<void> {
  const { error } = await admin
    .from('group_members')
    .insert({ group_id: groupId, user_id: userId, role: 'member' })
  if (error) throw error
}

/** 테스트가 만든 데이터 정리 — 실DB를 더럽히지 않는다 */
export async function cleanup(groupIds: string[], userIds: string[]): Promise<void> {
  if (groupIds.length > 0) {
    await admin.from('groups').delete().in('id', groupIds)
  }
  for (const id of userIds) {
    await admin.auth.admin.deleteUser(id)
  }
}
