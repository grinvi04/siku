import { useMutation, useQuery } from '@tanstack/react-query'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/Button'
import { useToast } from '@/components/Toast'
import { getInvitePreview, joinGroup } from '@/data/groups'
import { useSession } from '@/features/auth/useSession'

export function InvitePage() {
  const { code } = useParams<{ code: string }>()
  const { session, loading } = useSession()
  const location = useLocation()
  const navigate = useNavigate()
  const toast = useToast()

  const { data: preview, isLoading } = useQuery({
    queryKey: ['invite', code],
    queryFn: () => getInvitePreview(code!),
    enabled: !!code && !!session,
  })

  const join = useMutation({
    mutationFn: () => joinGroup(code!),
    onSuccess: (groupId) => {
      toast('모임에 가입했어요')
      navigate(`/groups/${groupId}`, { replace: true })
    },
    onError: () => toast('가입하지 못했어요. 링크를 다시 확인해 주세요'),
  })

  if (loading) return null
  if (!session) {
    // 로그인 후 이 초대 페이지로 돌아온다
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />
  }
  if (isLoading) return <p className="px-5 pt-24 text-center text-ink-soft">확인하고 있어요…</p>

  if (!preview) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-5 text-center">
        <p className="text-base text-ink-soft">유효하지 않은 초대 링크예요.</p>
        <p className="mt-1 text-sm text-ink-soft">모임장에게 새 링크를 받아 주세요.</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh flex-col justify-center px-5 text-center">
      <p className="text-sm text-ink-soft">모임 초대</p>
      <h1 className="mt-1 text-[28px] font-bold">{preview.name}</h1>
      <p className="mt-2 text-base text-ink-soft">멤버 {preview.member_count}명이 함께하고 있어요</p>
      <div className="mt-10">
        <Button onClick={() => join.mutate()} disabled={join.isPending}>
          {join.isPending ? '가입하고 있어요…' : '이 모임에 가입하기'}
        </Button>
      </div>
    </div>
  )
}
