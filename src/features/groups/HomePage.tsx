import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/Button'
import { getMyProfile } from '@/data/profiles'
import { listMyGroups } from '@/data/groups'
import { ChevronRight, UsersRound } from 'lucide-react'
import { CardListSkeleton } from '@/components/Skeleton'

export function HomePage() {
  const navigate = useNavigate()
  const { data: profile } = useQuery({ queryKey: ['myProfile'], queryFn: getMyProfile })
  const { data: groups, isLoading } = useQuery({ queryKey: ['groups'], queryFn: listMyGroups })

  return (
    <div className="min-h-dvh px-5 pt-6 pb-[calc(env(safe-area-inset-bottom)+16px)]">
      <header className="flex items-center justify-between">
        <h1 className="text-[22px] font-bold">내 식구</h1>
        <Link to="/profile" className="flex h-11 items-center gap-2 text-sm text-ink-soft">
          {profile?.avatar_url && (
            <img src={profile.avatar_url} alt="" className="h-8 w-8 rounded-full" />
          )}
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
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-container text-primary">
                  <UsersRound size={22} />
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
        <div className="mt-24 text-center">
          <UsersRound size={40} className="mx-auto text-ink-faint" />
          <p className="mt-3 text-base text-ink-soft">아직 식구가 없어요.</p>
          <p className="mt-1 text-sm text-ink-soft">아래 버튼으로 첫 식구를 만들어 보세요.</p>
        </div>
      )}

      <div className="mt-8">
        <Button onClick={() => navigate('/groups/new')}>새 식구 만들기</Button>
      </div>
    </div>
  )
}
