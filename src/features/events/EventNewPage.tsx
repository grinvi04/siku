import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/Button'
import { Chip } from '@/components/Chip'
import { Input } from '@/components/Input'
import { useToast } from '@/components/Toast'
import { getGroup } from '@/data/groups'
import { createEvent, EVENT_TYPE_LABEL, type EventType } from '@/data/events'

const TYPES = (Object.keys(EVENT_TYPE_LABEL) as EventType[]).map((value) => ({
  value,
  label: EVENT_TYPE_LABEL[value],
}))

export function EventNewPage() {
  const { groupId } = useParams<{ groupId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()

  const { data: group } = useQuery({
    queryKey: ['group', groupId],
    queryFn: () => getGroup(groupId!),
    enabled: !!groupId,
  })

  const [type, setType] = useState<EventType>('dinner')
  // null = 아직 손대지 않음 → 전원 선택이 기본값, 빼고 싶은 사람만 눌러서 제외
  const [touched, setTouched] = useState<Set<string> | null>(null)
  const participantIds = touched ?? new Set(group?.members.map((m) => m.user_id) ?? [])

  const toggleParticipant = (userId: string) => {
    const next = new Set(participantIds)
    if (next.has(userId)) next.delete(userId)
    else next.add(userId)
    setTouched(next)
  }

  const create = useMutation({
    mutationFn: createEvent,
    onSuccess: (eventId) => {
      void queryClient.invalidateQueries({ queryKey: ['events', groupId] })
      toast('기록을 남겼어요')
      navigate(`/events/${eventId}`, { replace: true })
    },
    onError: () => toast('기록을 남기지 못했어요. 다시 시도해 주세요'),
  })

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const title = String(form.get('title') ?? '').trim()
    const startDate = String(form.get('start_date') ?? '')
    const endDate = String(form.get('end_date') ?? '')
    if (!title || !startDate) return
    if (participantIds.size === 0) {
      toast('함께한 사람을 한 명 이상 선택해 주세요')
      return
    }
    create.mutate({
      groupId: groupId!,
      title,
      type,
      startsAt: new Date(`${startDate}T00:00:00`).toISOString(),
      endsAt: endDate ? new Date(`${endDate}T23:59:59`).toISOString() : null,
      participantIds: [...participantIds],
    })
  }

  const today = new Date().toISOString().slice(0, 10)

  return (
    <form className="min-h-dvh px-5 pt-6 pb-[calc(env(safe-area-inset-bottom)+16px)]" onSubmit={handleSubmit}>
      <button type="button" className="h-11 text-base text-ink-soft" onClick={() => navigate(-1)}>
        ‹ 뒤로
      </button>
      <h1 className="mt-2 text-[22px] font-bold">새 모임 기록</h1>

      <div className="mt-6 space-y-5">
        <div>
          <span className="mb-1.5 block text-sm text-ink-soft">어떤 모임이었나요?</span>
          <div className="flex flex-wrap gap-2">
            {TYPES.map((t) => (
              <Chip key={t.value} selected={type === t.value} onClick={() => setType(t.value)}>
                {t.label}
              </Chip>
            ))}
          </div>
        </div>

        <Input id="title" name="title" label="이름" placeholder="예: 6월 정기모임, 제주 라이딩" required />

        <div className="grid grid-cols-2 gap-3">
          <Input id="start_date" name="start_date" type="date" label="시작일" defaultValue={today} required />
          <Input id="end_date" name="end_date" type="date" label="종료일 (1박 이상이면)" />
        </div>

        <div>
          <span className="mb-1.5 block text-sm text-ink-soft">
            함께한 사람 — 누르면 뺄 수 있어요
          </span>
          <div className="flex flex-wrap gap-2">
            {group?.members.map((m) => (
              <Chip
                key={m.user_id}
                selected={participantIds.has(m.user_id)}
                onClick={() => toggleParticipant(m.user_id)}
              >
                {m.profile.display_name}
              </Chip>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-8">
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? '남기고 있어요…' : '기록 남기기'}
        </Button>
      </div>
    </form>
  )
}
