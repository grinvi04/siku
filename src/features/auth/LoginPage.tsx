import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { sendMagicLink } from '@/data/supabase'
import { isKakaoInAppBrowser, openInExternalBrowser } from './inAppBrowser'
import { sanitizeNextPath } from './nextPath'

export function LoginPage() {
  const [searchParams] = useSearchParams()
  const next = sanitizeNextPath(searchParams.get('next'))
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const email = String(new FormData(e.currentTarget).get('email') ?? '').trim()
    if (!email) return
    setPending(true)
    setError(null)
    const { error } = await sendMagicLink(email, next)
    setPending(false)
    if (error) setError('링크를 보내지 못했어요. 이메일 주소를 확인하고 다시 시도해 주세요')
    else setSentTo(email)
  }

  if (sentTo) {
    return (
      <div className="flex min-h-dvh flex-col justify-center px-5 text-center">
        <h1 className="text-[22px] font-bold">메일함을 확인해 주세요</h1>
        <p className="mt-3 text-base leading-[1.55] text-ink-soft">
          <span className="font-semibold text-ink">{sentTo}</span>
          (으)로 로그인 링크를 보냈어요.
          <br />
          메일 속 버튼을 누르면 바로 로그인돼요.
        </p>
        <button
          className="mt-8 text-base font-semibold text-primary"
          onClick={() => setSentTo(null)}
        >
          다른 이메일로 받기
        </button>
      </div>
    )
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

      <form className="space-y-3" onSubmit={handleSubmit}>
        {isKakaoInAppBrowser() && (
          <button
            type="button"
            onClick={openInExternalBrowser}
            className="w-full rounded-xl bg-surface px-4 py-3 text-left text-sm leading-[1.5] text-ink-soft"
          >
            카카오톡 안에서는 일부 기능이 제한돼요.
            <span className="font-semibold text-primary"> 외부 브라우저로 열기 →</span>
          </button>
        )}
        <Input
          id="email"
          name="email"
          type="email"
          label="이메일"
          placeholder="example@email.com"
          autoComplete="email"
          inputMode="email"
          required
        />
        <Button type="submit" disabled={pending}>
          {pending ? '보내고 있어요…' : '이메일로 로그인 링크 받기'}
        </Button>
        <p className="text-center text-sm leading-[1.5] text-ink-soft">
          비밀번호 없이, 메일로 받은 링크 하나로 로그인해요
        </p>
        {error && <p className="text-center text-sm text-error">{error}</p>}
      </form>
    </div>
  )
}
