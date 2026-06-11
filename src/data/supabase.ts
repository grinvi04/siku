import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!url || !anonKey) {
  throw new Error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 환경변수가 필요합니다 (.env.example 참조)')
}

export const supabase = createClient(url, anonKey)

/** 카카오 로그인 — 비즈 앱 미전환 전제: 이메일 동의항목 없이 닉네임·프로필만 요청 */
export function signInWithKakao() {
  return supabase.auth.signInWithOAuth({
    provider: 'kakao',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      scopes: 'profile_nickname profile_image',
    },
  })
}
