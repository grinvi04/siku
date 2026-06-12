import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { useToast } from '@/components/Toast'
import { getMyProfile, updateMyProfile } from '@/data/profiles'
import { Avatar } from '@/components/Avatar'
import { LogOut } from 'lucide-react'
import { supabase } from '@/data/supabase'

/** 프로필 + 정산 계좌 입력 — 계좌는 정산 송금 안내에 그대로 노출된다 */
export function ProfilePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()
  const { data: profile, isLoading } = useQuery({ queryKey: ['myProfile'], queryFn: getMyProfile })

  const save = useMutation({
    mutationFn: (form: FormData) => {
      const displayName = String(form.get('display_name') ?? '').trim()
      if (!displayName) throw new Error('EMPTY_NAME')
      return updateMyProfile({
        display_name: displayName,
        bank_name: String(form.get('bank_name') ?? '').trim() || null,
        account_number: String(form.get('account_number') ?? '').trim() || null,
        account_holder: String(form.get('account_holder') ?? '').trim() || null,
      })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['myProfile'] })
      toast('저장했어요')
    },
    onError: (e) =>
      toast(
        e instanceof Error && e.message === 'EMPTY_NAME'
          ? '닉네임을 입력해 주세요'
          : '저장에 실패했어요. 다시 시도해 주세요',
      ),
  })

  if (isLoading || !profile) {
    return <div className="px-5 pt-24 text-center text-ink-soft">불러오는 중…</div>
  }

  return (
    <form
      className="min-h-dvh px-5 pt-6 pb-[calc(env(safe-area-inset-bottom)+16px)]"
      onSubmit={(e) => {
        e.preventDefault()
        save.mutate(new FormData(e.currentTarget))
      }}
    >
      {/* 로그인 직후 ?next=로 바로 진입할 수 있어 navigate(-1) 대신 홈 고정 이동 */}
      <button
        type="button"
        className="h-11 text-base text-ink-soft"
        onClick={() => navigate('/', { replace: true })}
      >
        ‹ 홈으로
      </button>
      <div className="mt-2 flex items-center gap-3">
        <Avatar name={profile.display_name} id={profile.id} size={52} />
        <div>
          <h1 className="text-[22px] font-bold">내 정보</h1>
          <p className="mt-0.5 text-sm text-ink-soft">계좌는 정산할 때 식구들에게 보여져요.</p>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        <Input
          id="display_name"
          name="display_name"
          label="닉네임"
          maxLength={20}
          defaultValue={profile.display_name}
          required
        />
        <Input
          id="bank_name"
          name="bank_name"
          label="은행"
          placeholder="예: 국민은행"
          defaultValue={profile.bank_name ?? ''}
        />
        <Input
          id="account_number"
          name="account_number"
          label="계좌번호"
          inputMode="numeric"
          placeholder="숫자만 입력해도 돼요"
          defaultValue={profile.account_number ?? ''}
        />
        <Input
          id="account_holder"
          name="account_holder"
          label="예금주"
          placeholder="이름과 다르면 입력해 주세요"
          defaultValue={profile.account_holder ?? ''}
        />
      </div>

      <div className="mt-8 space-y-3">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? '저장하고 있어요…' : '저장'}
        </Button>
      </div>

      <div className="mt-10 border-t border-line pt-4">
        <button
          type="button"
          className="flex h-11 w-full items-center justify-center gap-1.5 text-base font-semibold text-ink-soft"
          onClick={() => void supabase.auth.signOut()}
        >
          <LogOut size={17} /> 로그아웃
        </button>
      </div>
      <p className="mt-10 text-center text-sm text-ink-soft">버전 {__BUILD_TIME__}</p>
    </form>
  )
}
