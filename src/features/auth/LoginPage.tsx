import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { sendMagicLink } from '@/data/supabase'
import { Images, MapPin, ReceiptText } from 'lucide-react'
import { isKakaoInAppBrowser, openInExternalBrowser } from './inAppBrowser'
import { sanitizeNextPath } from './nextPath'

export function LoginPage() {
  const [searchParams] = useSearchParams()
  const next = sanitizeNextPath(searchParams.get('next'))
  const [sentTo, setSentTo] = useState<string | null>(null)
  // 로그인이 풀려도(브라우저 데이터 삭제 등) 이메일은 다시 안 치게 기억해 둔다
  const [savedEmail] = useState(() => localStorage.getItem('moim:lastEmail') ?? '')
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
    if (error) {
      setError('링크를 보내지 못했어요. 이메일 주소를 확인하고 다시 시도해 주세요')
    } else {
      localStorage.setItem('moim:lastEmail', email)
      setSentTo(email)
    }
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
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-[26px] font-bold text-white">
          식
        </div>
        <p className="mt-3 text-sm font-bold tracking-[0.25em] text-primary">SIKU</p>
        <h1 className="mt-1.5 text-[28px] leading-[1.35] font-bold">
          밥 같이 먹는 사이,
          <br />
          식구
        </h1>
        <ul className="mt-5 space-y-3">
          <li className="flex items-start gap-2.5 text-base leading-[1.5] text-ink-soft">
            <ReceiptText size={20} className="mt-0.5 shrink-0 text-primary" />
            계좌번호 복사 한 번으로 끝나는 정산
          </li>
          <li className="flex items-start gap-2.5 text-base leading-[1.5] text-ink-soft">
            <Images size={20} className="mt-0.5 shrink-0 text-accent" />
            모임 사진을 한곳에 모아보기
          </li>
          <li className="flex items-start gap-2.5 text-base leading-[1.5] text-ink-soft">
            <MapPin size={20} className="mt-0.5 shrink-0 text-accent" />
            사진 위치로 다녀온 곳 자동 기록
          </li>
        </ul>
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
          defaultValue={savedEmail}
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
