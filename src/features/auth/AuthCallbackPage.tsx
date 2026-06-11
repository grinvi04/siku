import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ensureProfile } from '../../data/profiles'
import { supabase } from '../../data/supabase'

/** OAuth 리다이렉트 처리 — supabase-js의 URL 코드→세션 교환이 끝날 때까지 기다린다 */
export function AuthCallbackPage() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let done = false

    const complete = async () => {
      if (done) return
      done = true
      try {
        await ensureProfile()
        navigate('/', { replace: true })
      } catch {
        setError('로그인 처리에 실패했어요. 다시 시도해 주세요.')
      }
    }

    // 이미 세션이 있으면 바로, 없으면 교환 완료(SIGNED_IN) 이벤트를 기다림
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) void complete()
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') void complete()
    })
    const timeout = setTimeout(() => {
      if (!done) setError('로그인 처리에 실패했어요. 다시 시도해 주세요.')
    }, 10_000)

    return () => {
      sub.subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [navigate])

  return (
    <div className="flex min-h-dvh items-center justify-center px-5">
      {error ? (
        <p className="text-center text-base text-ink-soft">{error}</p>
      ) : (
        <p className="text-base text-ink-soft">로그인하고 있어요…</p>
      )}
    </div>
  )
}
