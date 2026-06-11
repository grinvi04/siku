import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button } from '../../components/Button'
import { useToast } from '../../components/Toast'
import { getGroup } from '../../data/groups'
import { listEvents, type EventType } from '../../data/events'
import { formatDateRange } from '../../lib/format'

const TYPE_LABEL: Record<EventType, string> = { dinner: '저녁모임', ride: '라이딩', trip: '여행' }

export function GroupPage() {
  const { groupId } = useParams<{ groupId: string }>()
  const navigate = useNavigate()
  const toast = useToast()

  const { data: group } = useQuery({
    queryKey: ['group', groupId],
    queryFn: () => getGroup(groupId!),
    enabled: !!groupId,
  })
  const { data: events, isLoading } = useQuery({
    queryKey: ['events', groupId],
    queryFn: () => listEvents(groupId!),
    enabled: !!groupId,
  })

  const copyInviteLink = async () => {
    if (!group) return
    await navigator.clipboard.writeText(`${window.location.origin}/invite/${group.invite_code}`)
    toast('초대 링크를 복사했어요. 카카오톡에 붙여넣어 보내세요')
  }

  if (!group) return <p className="px-5 pt-24 text-center text-ink-soft">불러오는 중…</p>

  return (
    <div className="min-h-dvh px-5 pt-6 pb-[calc(env(safe-area-inset-bottom)+16px)]">
      <button type="button" className="h-11 text-base text-ink-soft" onClick={() => navigate('/')}>
        ‹ 내 모임
      </button>
      <header className="mt-2">
        <h1 className="text-[22px] font-bold">{group.name}</h1>
        <div className="mt-2 flex items-center gap-1.5 overflow-x-auto">
          {group.members.map((m) => (
            <span
              key={m.user_id}
              className="shrink-0 rounded-full bg-surface px-3 py-1.5 text-sm text-ink-soft"
            >
              {m.profile.display_name}
            </span>
          ))}
          <button
            type="button"
            onClick={copyInviteLink}
            className="shrink-0 rounded-full bg-primary-container px-3 py-1.5 text-sm font-semibold text-primary"
          >
            + 멤버 초대
          </button>
        </div>
      </header>

      <section className="mt-8">
        <h2 className="text-[19px] font-semibold">지난 기록</h2>
        {isLoading ? (
          <p className="mt-8 text-center text-ink-soft">불러오는 중…</p>
        ) : events && events.length > 0 ? (
          <ul className="mt-2">
            {events.map((event) => (
              <li key={event.id} className="border-b border-line">
                <Link
                  to={`/events/${event.id}`}
                  className="flex min-h-14 items-center justify-between py-4"
                >
                  <div>
                    <p className="text-base font-semibold">{event.title}</p>
                    <p className="mt-0.5 text-sm text-ink-soft">
                      {formatDateRange(event.starts_at, event.ends_at)} · {TYPE_LABEL[event.type]} ·{' '}
                      {event.participant_count}명
                    </p>
                  </div>
                  <span className="text-ink-soft">›</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-12 text-center">
            <p className="text-base text-ink-soft">아직 기록이 없어요.</p>
            <p className="mt-1 text-sm text-ink-soft">
              저녁모임이나 여행을 다녀왔다면 아래에서 기록해 보세요.
            </p>
          </div>
        )}
      </section>

      <div className="mt-8">
        <Button onClick={() => navigate(`/groups/${group.id}/events/new`)}>
          새 모임 기록하기
        </Button>
      </div>
    </div>
  )
}
