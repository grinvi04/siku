import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getEvent, type EventType } from '@/data/events'
import { formatDateRange } from '@/lib/format'
import { SettleTab } from '@/features/expenses/SettleTab'
import { PhotosTab } from '@/features/photos/PhotosTab'

const TYPE_LABEL: Record<EventType, string> = { dinner: '저녁모임', ride: '라이딩', trip: '여행' }

const TABS = [
  { key: 'settle', label: '정산' },
  { key: 'photos', label: '사진' },
  { key: 'places', label: '다녀온 곳' },
] as const
type TabKey = (typeof TABS)[number]['key']

export function EventPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const navigate = useNavigate()
  const [tab, setTab] = useState<TabKey>('settle')

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
          {formatDateRange(event.starts_at, event.ends_at)} · {TYPE_LABEL[event.type]} ·{' '}
          {event.participants.map((p) => p.display_name).join(', ')}
        </p>
      </header>

      {/* 화면 이동 없이 탭 전환 (DESIGN.md — 깊이 2단계 제한) */}
      <nav className="mt-5 grid grid-cols-3 rounded-xl bg-surface p-1" aria-label="이벤트 메뉴">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            aria-current={tab === t.key}
            className={`h-11 rounded-lg text-base transition-colors ${
              tab === t.key ? 'bg-white font-semibold text-primary shadow-[0_2px_8px_rgba(26,32,44,0.08)]' : 'text-ink-soft'
            }`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'settle' && <SettleTab event={event} />}
      {tab === 'photos' && <PhotosTab event={event} />}
      {tab === 'places' && (
        <p className="mt-12 text-center text-base text-ink-soft">
          사진을 올리면 다녀온 곳을 자동으로 정리해 드려요.
        </p>
      )}
    </div>
  )
}
