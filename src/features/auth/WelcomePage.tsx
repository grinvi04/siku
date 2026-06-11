import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/Button'
import { Input } from '../../components/Input'
import { useToast } from '../../components/Toast'
import { updateMyProfile } from '../../data/profiles'

/** 첫 로그인 온보딩 — 이메일 아이디 대신 부를 이름(닉네임)을 정한다 */
export function WelcomePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()

  const save = useMutation({
    mutationFn: (displayName: string) => updateMyProfile({ display_name: displayName }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['myProfile'] })
      toast('반가워요! 모임을 시작해 보세요')
      navigate('/', { replace: true })
    },
    onError: () => toast('저장하지 못했어요. 다시 시도해 주세요'),
  })

  return (
    <form
      className="flex min-h-dvh flex-col justify-center px-5"
      onSubmit={(e) => {
        e.preventDefault()
        const name = String(new FormData(e.currentTarget).get('display_name') ?? '').trim()
        if (name) save.mutate(name)
      }}
    >
      <h1 className="text-[28px] leading-[1.35] font-bold">
        환영해요!
        <br />
        어떻게 불러드릴까요?
      </h1>
      <p className="mt-2 text-base text-ink-soft">멤버들에게 보여질 이름이에요.</p>

      <div className="mt-8">
        <Input
          id="display_name"
          name="display_name"
          label="닉네임"
          placeholder="예: 홍길동, 길동이"
          autoComplete="nickname"
          maxLength={20}
          required
          autoFocus
        />
      </div>

      <div className="mt-8">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? '저장하고 있어요…' : '시작하기'}
        </Button>
        <p className="mt-3 text-center text-sm text-ink-soft">
          정산용 계좌는 나중에 ‘내 정보’에서 등록할 수 있어요.
        </p>
      </div>
    </form>
  )
}
