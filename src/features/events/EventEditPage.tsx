import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/Button'
import { Chip } from '@/components/Chip'
import { Input } from '@/components/Input'
import { useToast } from '@/components/Toast'
import { EVENT_TYPE_LABEL, getEvent, updateEvent, type EventType } from '@/data/events'

const TYPES = (Object.keys(EVENT_TYPE_LABEL) as EventType[]).map((value) => ({
  value,
  label: EVENT_TYPE_LABEL[value],
}))

/** 기록 수정 — 종류·이름·날짜 (참가자 변경은 정산과 얽혀 있어 제외) */
export function EventEditPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [typeValue, setTypeValue] = useState<EventType | null>(null)

  const { data: event } = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => getEvent(eventId!),
    enabled: !!eventId,
  })

  const save = useMutation({
    mutationFn: (patch: Parameters<typeof updateEvent>[1]) => updateEvent(eventId!, patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['event', eventId] })
      void queryClient.invalidateQueries({ queryKey: ['events', event?.group_id] })
      toast('기록을 고쳤어요')
      navigate(`/events/${eventId}`, { replace: true })
    },
    onError: () => toast('저장하지 못했어요. 다시 시도해 주세요'),
  })

  if (!event) return <p className="px-5 pt-24 text-center text-ink-soft">불러오는 중…</p>

  const type = typeValue ?? event.type

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const title = String(form.get('title') ?? '').trim()
    const startDate = String(form.get('start_date') ?? '')
    const endDate = String(form.get('end_date') ?? '')
    if (!title || !startDate) return
    save.mutate({
      title,
      type,
      startsAt: new Date(`${startDate}T00:00:00`).toISOString(),
      endsAt: endDate ? new Date(`${endDate}T23:59:59`).toISOString() : null,
    })
  }

  return (
    <form
      className="min-h-dvh px-5 pt-6 pb-[calc(env(safe-area-inset-bottom)+16px)]"
      onSubmit={handleSubmit}
    >
      <button
        type="button"
        className="h-11 text-base text-ink-soft"
        onClick={() => navigate(`/events/${eventId}`)}
      >
        ‹ 뒤로
      </button>
      <h1 className="mt-2 text-[22px] font-bold">기록 고치기</h1>

      <div className="mt-6 space-y-5">
        <div>
          <span className="mb-1.5 block text-sm text-ink-soft">어떤 모임이었나요?</span>
          <div className="flex flex-wrap gap-2">
            {TYPES.map((t) => (
              <Chip key={t.value} selected={type === t.value} onClick={() => setTypeValue(t.value)}>
                {t.label}
              </Chip>
            ))}
          </div>
        </div>

        <Input id="title" name="title" label="이름" defaultValue={event.title} required />

        <div className="grid grid-cols-2 gap-3">
          <Input
            id="start_date"
            name="start_date"
            type="date"
            label="시작일"
            defaultValue={event.starts_at.slice(0, 10)}
            required
          />
          <Input
            id="end_date"
            name="end_date"
            type="date"
            label="종료일 (여행이면)"
            defaultValue={event.ends_at?.slice(0, 10) ?? ''}
          />
        </div>
      </div>

      <div className="mt-8">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? '저장하고 있어요…' : '저장'}
        </Button>
      </div>
    </form>
  )
}
