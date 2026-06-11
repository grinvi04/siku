import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useToast } from '@/components/Toast'
import { deleteEvent, EVENT_TYPE_LABEL, getEvent } from '@/data/events'
import { formatDateRange } from '@/lib/format'
import { SettleTab } from '@/features/expenses/SettleTab'
import { PhotosTab } from '@/features/photos/PhotosTab'
import { VisitsTab } from '@/features/places/VisitsTab'
import { useSession } from '@/features/auth/useSession'
import { Images, MapPin, ReceiptText } from 'lucide-react'
import { Skeleton } from '@/components/Skeleton'

const TABS = [
  { key: 'settle', label: '정산', icon: ReceiptText },
  { key: 'photos', label: '사진', icon: Images },
  { key: 'places', label: '다녀온 곳', icon: MapPin },
] as const
type TabKey = (typeof TABS)[number]['key']

export function EventPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const navigate = useNavigate()
  const { session } = useSession()
  const toast = useToast()
  const [tab, setTab] = useState<TabKey>('settle')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const { data: event } = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => getEvent(eventId!),
    enabled: !!eventId,
  })

  const remove = useMutation({
    mutationFn: () => deleteEvent(eventId!),
    onSuccess: () => {
      toast('기록을 지웠어요')
      navigate(`/groups/${event!.group_id}`, { replace: true })
    },
    onError: (e) => {
      toast(
        e instanceof Error && e.message === 'SETTLEMENT_CLOSED'
          ? '확정된 정산이 있어요. 정산을 취소한 후 지울 수 있어요'
          : '지우지 못했어요. 다시 시도해 주세요',
      )
    },
  })

  if (!event) {
    return (
      <div className="px-5 pt-6">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="mt-5 h-7 w-44" />
        <Skeleton className="mt-2 h-4 w-60" />
        <Skeleton className="mt-5 h-12 rounded-xl" />
        <Skeleton className="mt-6 h-36 rounded-2xl" />
      </div>
    )
  }

  const isCreator = session?.user.id === event.created_by

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
          {formatDateRange(event.starts_at, event.ends_at)} · {EVENT_TYPE_LABEL[event.type]} ·{' '}
          {event.participants.map((p, i) => (
            <span key={p.user_id}>
              {i > 0 && ', '}
              <span
                className={p.user_id === session?.user.id ? 'font-semibold text-primary' : ''}
              >
                {p.display_name}
              </span>
            </span>
          ))}
        </p>
      </header>

      {/* 화면 이동 없이 탭 전환 (DESIGN.md — 깊이 2단계 제한) */}
      <nav className="mt-5 grid grid-cols-3 rounded-xl bg-surface p-1" aria-label="이벤트 메뉴">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            aria-current={tab === t.key}
            className={`flex h-11 items-center justify-center gap-1.5 rounded-lg text-base transition-colors ${
              tab === t.key ? 'bg-white font-semibold text-primary shadow-[0_2px_8px_rgba(26,32,44,0.08)]' : 'text-ink-soft'
            }`}
            onClick={() => setTab(t.key)}
          >
            <t.icon size={18} />
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'settle' && <SettleTab event={event} />}
      {tab === 'photos' && <PhotosTab event={event} />}
      {tab === 'places' && <VisitsTab event={event} />}

      {/* 기록 삭제 — 만든 사람만 (모임장 권한은 DB에서 함께 허용됨) */}
      {isCreator && (
        <div className="mt-12 border-t border-line pt-4">
          <button
            type="button"
            className="h-11 w-full text-sm text-ink-soft"
            onClick={() => setConfirmDelete(true)}
          >
            이 기록 지우기
          </button>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="기록을 지울까요?"
        message="이 기록의 지출·사진·다녀온 곳이 모두 함께 지워져요. 되돌릴 수 없어요."
        confirmLabel="지우기"
        danger
        onConfirm={() => {
          setConfirmDelete(false)
          remove.mutate()
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  )
}
