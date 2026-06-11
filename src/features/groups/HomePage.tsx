import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/Button'
import { getMyProfile } from '@/data/profiles'
import { listMyGroups } from '@/data/groups'

export function HomePage() {
  const navigate = useNavigate()
  const { data: profile } = useQuery({ queryKey: ['myProfile'], queryFn: getMyProfile })
  const { data: groups, isLoading } = useQuery({ queryKey: ['groups'], queryFn: listMyGroups })

  return (
    <div className="min-h-dvh px-5 pt-6 pb-[calc(env(safe-area-inset-bottom)+16px)]">
      <header className="flex items-center justify-between">
        <h1 className="text-[22px] font-bold">내 모임</h1>
        <Link to="/profile" className="flex h-11 items-center gap-2 text-sm text-ink-soft">
          {profile?.avatar_url && (
            <img src={profile.avatar_url} alt="" className="h-8 w-8 rounded-full" />
          )}
          {profile?.display_name} ›
        </Link>
      </header>

      {isLoading ? (
        <p className="mt-24 text-center text-ink-soft">불러오는 중…</p>
      ) : groups && groups.length > 0 ? (
        <ul className="mt-4">
          {groups.map((group) => (
            <li key={group.id} className="border-b border-line">
              <Link
                to={`/groups/${group.id}`}
                className="flex min-h-14 items-center justify-between py-4"
              >
                <span className="text-base font-semibold">{group.name}</span>
                <span className="text-sm text-ink-soft">멤버 {group.member_count}명 ›</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-24 text-center">
          <p className="text-base text-ink-soft">아직 모임이 없어요.</p>
          <p className="mt-1 text-sm text-ink-soft">아래 버튼으로 첫 모임을 만들어 보세요.</p>
        </div>
      )}

      <div className="mt-8">
        <Button onClick={() => navigate('/groups/new')}>새 모임 만들기</Button>
      </div>
    </div>
  )
}
