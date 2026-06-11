import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!url || !anonKey) {
  throw new Error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 환경변수가 필요합니다 (.env.example 참조)')
}

export const supabase = createClient(url, anonKey)

/**
 * 이메일 매직링크 로그인 — 1회용·만료 토큰, 비밀번호 없음.
 * @param next 로그인 후 돌아갈 경로 (초대 링크 등 딥링크)
 */
export function sendMagicLink(email: string, next?: string) {
  const redirect = new URL('/auth/callback', window.location.origin)
  if (next) redirect.searchParams.set('next', next)
  return supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirect.toString() },
  })
}
