import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/Button'
import { getMyProfile } from '@/data/profiles'
import { listMyGroups } from '@/data/groups'
import { ChevronRight } from 'lucide-react'
import { CardListSkeleton } from '@/components/Skeleton'
import { Avatar } from '@/components/Avatar'
import { colorOf } from '@/components/identityColor'
import { RiceBowl } from '@/components/RiceBowl'

/** 시간대별 인사 — 40~60대 정서의 따뜻한 첫 줄 (보이스 이원화: 설명문은 감성) */
function greeting(): string {
  const h = new Date().getHours()
  if (h < 5) return '늦은 밤이에요, 천천히 둘러보세요'
  if (h < 11) return '좋은 아침이에요'
  if (h < 14) return '점심은 맛있게 드셨어요?'
  if (h < 18) return '나른한 오후, 잘 보내고 계시죠?'
  return '오늘 하루도 수고하셨어요'
}

export function HomePage() {
  const navigate = useNavigate()
  const { data: profile } = useQuery({ queryKey: ['myProfile'], queryFn: getMyProfile })
  const { data: groups, isLoading } = useQuery({ queryKey: ['groups'], queryFn: listMyGroups })

  return (
    <div className="min-h-dvh px-5 pt-6 pb-[calc(env(safe-area-inset-bottom)+16px)]">
      <p className="text-sm text-ink-soft">
        {greeting()}
        {profile ? `, ${profile.display_name}님` : ''}
      </p>
      <header className="mt-1 flex items-center justify-between">
        <h1 className="text-[22px] font-bold">내 식구</h1>
        <Link to="/profile" className="flex h-11 items-center gap-2 text-sm text-ink-soft">
          {profile && <Avatar name={profile.display_name} id={profile.id} size={28} />}
          {profile?.display_name} ›
        </Link>
      </header>

      {isLoading ? (
        <CardListSkeleton />
      ) : groups && groups.length > 0 ? (
        <ul className="mt-5 space-y-2.5">
          {groups.map((group) => (
            <li key={group.id}>
              <Link
                to={`/groups/${group.id}`}
                className="flex items-center gap-3 rounded-2xl border border-line bg-white p-4 transition-colors active:bg-surface"
              >
                {/* 그룹 이니셜 — id 고유색으로 카드마다 정체성 부여 (Avatar 팔레트 재사용) */}
                <span
                  aria-hidden
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[19px] font-bold"
                  style={{
                    backgroundColor: `color-mix(in srgb, ${colorOf(group.id)} 12%, white)`,
                    color: colorOf(group.id),
                  }}
                >
                  {group.name.slice(0, 1)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-semibold">{group.name}</p>
                  <p className="mt-0.5 text-sm text-ink-soft">식구 {group.member_count}명</p>
                </div>
                <ChevronRight size={20} className="shrink-0 text-ink-faint" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-20 text-center">
          <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full bg-accent-container">
            <RiceBowl size={72} />
          </div>
          <p className="mt-5 text-base font-semibold">아직 식구가 없어요</p>
          <p className="mt-1.5 text-sm leading-[1.6] text-ink-soft">
            같이 먹는 사이라면, 식구죠.
            <br />
            자주 만나는 사람들을 모아보세요.
          </p>
        </div>
      )}

      <div className="mt-8">
        <Button onClick={() => navigate('/groups/new')}>새 식구 만들기</Button>
      </div>
    </div>
  )
}
