import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { Avatar } from '@/components/Avatar'
import { EVENT_TYPE_ICON } from '@/components/eventTypeIcon'
import { CardListSkeleton } from '@/components/Skeleton'
import { EVENT_TYPE_LABEL, type EventType } from '@/data/events'
import { getGroup } from '@/data/groups'
import { getGroupStats } from '@/data/stats'
import { formatKrw } from '@/lib/format'
import { CalendarDays, Crown, Images, MapPin, Wallet } from 'lucide-react'

function StatCard({
  icon: Icon,
  label,
  value,
  accent = false,
}: {
  icon: typeof Wallet
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <span
        className={`flex h-9 w-9 items-center justify-center rounded-lg ${
          accent ? 'bg-accent-container text-accent' : 'bg-primary-container text-primary'
        }`}
      >
        <Icon size={18} />
      </span>
      <p className="mt-2.5 text-sm text-ink-soft">{label}</p>
      <p className="amount mt-0.5 text-[19px]">{value}</p>
    </div>
  )
}

function TopList({
  title,
  entries,
  nameOf,
  format,
}: {
  title: string
  entries: [string, number][]
  nameOf: (id: string) => string
  format: (n: number) => string
}) {
  if (entries.length === 0) return null
  return (
    <section className="mt-6">
      <h2 className="flex items-center gap-1.5 text-[19px] font-semibold">
        <Crown size={18} className="text-accent" /> {title}
      </h2>
      <ul className="mt-2 space-y-2">
        {entries.slice(0, 3).map(([userId, value], i) => (
          <li
            key={userId}
            className="flex items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3"
          >
            <span className="w-5 text-base font-bold text-ink-soft">{i + 1}</span>
            <Avatar name={nameOf(userId)} id={userId} size={32} />
            <span className="flex-1 truncate text-base font-semibold">{nameOf(userId)}</span>
            <span className="amount text-base text-ink-soft">{format(value)}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function StatsPage() {
  const { groupId } = useParams<{ groupId: string }>()
  const navigate = useNavigate()

  const { data: group } = useQuery({
    queryKey: ['group', groupId],
    queryFn: () => getGroup(groupId!),
    enabled: !!groupId,
  })
  const { data: stats, isLoading } = useQuery({
    queryKey: ['stats', groupId],
    queryFn: () => getGroupStats(groupId!),
    enabled: !!groupId,
  })

  const nameOf = (id: string) =>
    group?.members.find((m) => m.user_id === id)?.profile.display_name ?? '멤버'

  const sortDesc = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1])

  return (
    <div className="min-h-dvh px-5 pt-6 pb-[calc(env(safe-area-inset-bottom)+24px)]">
      <button
        type="button"
        className="h-11 text-base text-ink-soft"
        onClick={() => navigate(`/groups/${groupId}`)}
      >
        ‹ 모임으로
      </button>
      <h1 className="mt-2 text-[22px] font-bold">
        {group ? `${group.name} 통계` : '모임 통계'}
      </h1>

      {isLoading || !stats ? (
        <CardListSkeleton count={4} />
      ) : (
        <>
          <div className="mt-5 grid grid-cols-2 gap-2.5">
            <StatCard icon={CalendarDays} label="모임 횟수" value={`${stats.eventCount}회`} />
            <StatCard icon={Wallet} label="총 지출" value={formatKrw(stats.totalSpent)} />
            <StatCard icon={Images} label="사진" value={`${stats.photoCount}장`} accent />
            <StatCard icon={MapPin} label="다녀온 곳" value={`${stats.visitCount}곳`} accent />
          </div>

          {stats.eventCount > 0 && (
            <section className="mt-6">
              <h2 className="text-[19px] font-semibold">어떤 모임이 많았나</h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {(Object.entries(stats.typeCounts) as [EventType, number][])
                  .sort((a, b) => b[1] - a[1])
                  .map(([type, count]) => {
                    const Icon = EVENT_TYPE_ICON[type]
                    return (
                      <span
                        key={type}
                        className="flex items-center gap-1.5 rounded-full bg-surface px-3 py-2 text-sm text-ink"
                      >
                        <Icon size={16} className="text-accent" />
                        {EVENT_TYPE_LABEL[type]} <strong>{count}회</strong>
                      </span>
                    )
                  })}
              </div>
            </section>
          )}

          <TopList
            title="참석왕"
            entries={sortDesc(stats.attendCounts)}
            nameOf={nameOf}
            format={(n) => `${n}회`}
          />
          <TopList
            title="결제왕"
            entries={sortDesc(stats.paidSums)}
            nameOf={nameOf}
            format={formatKrw}
          />
        </>
      )}
    </div>
  )
}
