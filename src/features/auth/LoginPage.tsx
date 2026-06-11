import { useState } from 'react'
import { signInWithKakao } from '../../data/supabase'
import { isKakaoInAppBrowser, openInExternalBrowser } from './inAppBrowser'

export function LoginPage() {
  const [error, setError] = useState<string | null>(null)

  const handleKakaoLogin = async () => {
    setError(null)
    const { error } = await signInWithKakao()
    if (error) setError('로그인에 실패했어요. 잠시 후 다시 시도해 주세요.')
  }

  return (
    <div className="flex min-h-dvh flex-col justify-between px-5 pt-24 pb-[calc(env(safe-area-inset-bottom)+24px)]">
      <div>
        <h1 className="text-[28px] leading-[1.35] font-bold">
          모임의 기록과 정산,
          <br />한 곳에서
        </h1>
        <p className="mt-3 text-base leading-[1.55] text-ink-soft">
          다녀온 곳과 사진을 모으고,
          <br />
          경비는 계좌번호 복사 한 번으로 정산해요.
        </p>
      </div>

      <div className="space-y-3">
        {isKakaoInAppBrowser() && (
          <button
            onClick={openInExternalBrowser}
            className="w-full rounded-xl bg-surface px-4 py-3 text-left text-[13px] leading-[1.5] text-ink-soft"
          >
            카카오톡 안에서는 앱 설치가 안 돼요.
            <span className="font-semibold text-primary"> 외부 브라우저로 열기 →</span>
          </button>
        )}
        <button
          onClick={handleKakaoLogin}
          className="h-13 w-full rounded-xl bg-[#FEE500] text-base font-semibold text-[#191919] active:brightness-95"
        >
          카카오로 시작하기
        </button>
        {error && <p className="text-center text-[13px] text-error">{error}</p>}
      </div>
    </div>
  )
}
