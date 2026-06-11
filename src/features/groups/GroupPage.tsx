import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/Button'
import { useToast } from '@/components/Toast'
import { getGroup } from '@/data/groups'
import { EVENT_TYPE_LABEL, listEvents } from '@/data/events'
import { formatDateRange } from '@/lib/format'
import { useSession } from '@/features/auth/useSession'
import { EVENT_TYPE_ICON } from '@/components/eventTypeIcon'
import { BarChart3, CalendarPlus, ChevronRight } from 'lucide-react'
import { Avatar } from '@/components/Avatar'
import { CardListSkeleton } from '@/components/Skeleton'

export function GroupPage() {
  const { groupId } = useParams<{ groupId: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const { session } = useSession()
  const me = session?.user.id

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

  const shareInvite = async () => {
    if (!group) return
    const url = `${window.location.origin}/invite/${group.invite_code}`
    // 모바일: 네이티브 공유 시트 — 카카오톡을 누르면 대화방 선택으로 바로 이어진다
    if (navigator.share) {
      try {
        await navigator.share({
          title: '모임 초대',
          text: `'${group.name}' 모임에 초대해요. 아래 링크로 들어오세요!`,
          url,
        })
      } catch {
        // 사용자가 공유 시트를 닫은 경우 — 아무것도 하지 않음
      }
    } else {
      await navigator.clipboard.writeText(url)
      toast('초대 링크를 복사했어요. 카카오톡 등에 붙여넣어 보내세요')
    }
  }

  if (!group) return <p className="px-5 pt-24 text-center text-ink-soft">불러오는 중…</p>

  return (
    <div className="min-h-dvh px-5 pt-6 pb-[calc(env(safe-area-inset-bottom)+16px)]">
      <button type="button" className="h-11 text-base text-ink-soft" onClick={() => navigate('/')}>
        ‹ 내 모임
      </button>
      <header className="mt-2">
        <h1 className="text-[22px] font-bold">{group.name}</h1>
        {/* 멤버가 많아도 가려지지 않게 여러 줄로 감싼다 */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {group.members.map((m) => (
            <span
              key={m.user_id}
              className={`flex items-center gap-1.5 rounded-full py-1 pr-3 pl-1 text-sm ${
                m.user_id === me
                  ? 'bg-primary-container font-semibold text-primary'
                  : 'bg-surface text-ink-soft'
              }`}
            >
              <Avatar name={m.profile.display_name} id={m.user_id} size={24} />
              {m.profile.display_name}
            </span>
          ))}
          {/* 행동은 면 채움(파랑+흰 글씨) — 연한 파랑 정보 칩(나)과 층위 구분 */}
          <button
            type="button"
            onClick={() => void shareInvite()}
            className="rounded-full bg-primary px-3 py-1.5 text-sm font-semibold text-white active:bg-primary-pressed"
          >
            + 멤버 초대
          </button>
        </div>
      </header>

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-[19px] font-semibold">지난 기록</h2>
          <Link
            to={`/groups/${group.id}/stats`}
            className="flex h-11 items-center gap-1 px-2 text-sm font-semibold text-primary"
          >
            <BarChart3 size={16} /> 통계
          </Link>
        </div>
        {isLoading ? (
          <CardListSkeleton />
        ) : events && events.length > 0 ? (
          // 월별 섹션으로 묶어 표시 — 기록이 쌓여도 훑기 쉽게
          events
            .reduce<{ month: string; items: typeof events }[]>((groups, e) => {
              const d = new Date(e.starts_at)
              const month = `${d.getFullYear()}년 ${d.getMonth() + 1}월`
              const last = groups[groups.length - 1]
              if (last?.month === month) last.items.push(e)
              else groups.push({ month, items: [e] })
              return groups
            }, [])
            .map(({ month, items: monthEvents }) => (
            <div key={month}>
              <h3 className="mt-5 text-sm font-semibold text-ink-soft">{month}</h3>
              <ul className="mt-2 space-y-2">
                {monthEvents.map((event) => {
                  const TypeIcon = EVENT_TYPE_ICON[event.type]
                  return (
                    <li key={event.id}>
                      <Link
                        to={`/events/${event.id}`}
                        className="flex items-center gap-3 rounded-2xl border border-line bg-white p-4 transition-colors active:bg-surface"
                      >
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-container text-accent">
                          <TypeIcon size={22} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-base font-semibold">{event.title}</p>
                          <p className="mt-0.5 text-sm text-ink-soft">
                            {formatDateRange(event.starts_at, event.ends_at)} ·{' '}
                            {EVENT_TYPE_LABEL[event.type]} · {event.participant_count}명
                          </p>
                        </div>
                        <ChevronRight size={20} className="shrink-0 text-ink-faint" />
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))
        ) : (
          <div className="mt-12 text-center">
            <CalendarPlus size={40} className="mx-auto text-ink-faint" />
            <p className="mt-3 text-base text-ink-soft">아직 기록이 없어요.</p>
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
