import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/Button'
import { Input } from '../../components/Input'
import { useToast } from '../../components/Toast'
import { createGroup } from '../../data/groups'

export function GroupNewPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()

  const create = useMutation({
    mutationFn: createGroup,
    onSuccess: (groupId) => {
      void queryClient.invalidateQueries({ queryKey: ['groups'] })
      toast('모임을 만들었어요')
      navigate(`/groups/${groupId}`, { replace: true })
    },
    onError: () => toast('모임을 만들지 못했어요. 다시 시도해 주세요'),
  })

  return (
    <form
      className="min-h-dvh px-5 pt-6"
      onSubmit={(e) => {
        e.preventDefault()
        const name = String(new FormData(e.currentTarget).get('name') ?? '').trim()
        if (name) create.mutate(name)
      }}
    >
      <button type="button" className="h-11 text-base text-ink-soft" onClick={() => navigate(-1)}>
        ‹ 뒤로
      </button>
      <h1 className="mt-2 text-[22px] font-bold">새 모임 만들기</h1>
      <p className="mt-1 text-sm text-ink-soft">
        모임을 만들면 초대 링크로 멤버를 부를 수 있어요.
      </p>

      <div className="mt-6">
        <Input id="name" name="name" label="모임 이름" placeholder="예: 회사 동기 모임" required />
      </div>

      <div className="mt-8">
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? '만들고 있어요…' : '모임 만들기'}
        </Button>
      </div>
    </form>
  )
}
