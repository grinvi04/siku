import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ensureProfile } from '@/data/profiles'
import { supabase } from '@/data/supabase'
import { sanitizeNextPath } from './nextPath'

/** 매직링크 리다이렉트 처리 — supabase-js의 토큰→세션 교환이 끝날 때까지 기다린다 */
export function AuthCallbackPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let done = false
    const next = sanitizeNextPath(searchParams.get('next')) ?? null

    const complete = async () => {
      if (done) return
      done = true
      try {
        const { data: u } = await supabase.auth.getUser()
        if (u.user?.email) localStorage.setItem('moim:lastEmail', u.user.email)
        const { created } = await ensureProfile()
        // 초대 등 딥링크가 있으면 그쪽 우선, 첫 로그인이면 닉네임 정하기로
        navigate(next ?? (created ? '/welcome' : '/'), { replace: true })
      } catch {
        setError('로그인 처리에 실패했어요. 다시 시도해 주세요')
      }
    }

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) void complete()
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') void complete()
    })
    const timeout = setTimeout(() => {
      if (!done) setError('링크가 만료됐을 수 있어요. 로그인 링크를 다시 받아 주세요')
    }, 10_000)

    return () => {
      sub.subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [navigate, searchParams])

  return (
    <div className="flex min-h-dvh items-center justify-center px-5">
      {error ? (
        <div className="text-center">
          <p className="text-base text-ink-soft">{error}</p>
          <button
            className="mt-4 text-base font-semibold text-primary"
            onClick={() => navigate('/login', { replace: true })}
          >
            로그인으로 돌아가기
          </button>
        </div>
      ) : (
        <p className="text-base text-ink-soft">로그인하고 있어요…</p>
      )}
    </div>
  )
}
