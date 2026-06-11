import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { getEvent, type EventType } from '../../data/events'
import { formatDateRange } from '../../lib/format'

const TYPE_LABEL: Record<EventType, string> = { dinner: '저녁모임', ride: '라이딩', trip: '여행' }

export function EventPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const navigate = useNavigate()

  const { data: event } = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => getEvent(eventId!),
    enabled: !!eventId,
  })

  if (!event) return <p className="px-5 pt-24 text-center text-ink-soft">불러오는 중…</p>

  return (
    <div className="min-h-dvh px-5 pt-6 pb-[calc(env(safe-area-inset-bottom)+16px)]">
      <button
        type="button"
        className="h-11 text-base text-ink-soft"
        onClick={() => navigate(`/groups/${event.group_id}`)}
      >
        ‹ 모임으로
      </button>
      <header className="mt-2">
        <h1 className="text-[22px] font-bold">{event.title}</h1>
        <p className="mt-1 text-sm text-ink-soft">
          {formatDateRange(event.starts_at, event.ends_at)} · {TYPE_LABEL[event.type]}
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {event.participants.map((p) => (
            <span key={p.user_id} className="rounded-full bg-surface px-3 py-1.5 text-sm text-ink-soft">
              {p.display_name}
            </span>
          ))}
        </div>
      </header>

      {/* M3(정산)·M4(사진)·M5(다녀온 곳)가 이 자리에 탭으로 들어온다 */}
      <div className="mt-12 space-y-3">
        <div className="rounded-2xl border border-line p-4">
          <h2 className="text-[19px] font-semibold">정산</h2>
          <p className="mt-1 text-sm text-ink-soft">곧 여기서 경비를 정리할 수 있어요.</p>
        </div>
        <div className="rounded-2xl border border-line p-4">
          <h2 className="text-[19px] font-semibold">사진</h2>
          <p className="mt-1 text-sm text-ink-soft">곧 여기에 사진을 올릴 수 있어요.</p>
        </div>
        <div className="rounded-2xl border border-line p-4">
          <h2 className="text-[19px] font-semibold">다녀온 곳</h2>
          <p className="mt-1 text-sm text-ink-soft">사진을 올리면 자동으로 정리해 드려요.</p>
        </div>
      </div>
    </div>
  )
}
