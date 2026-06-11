import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getMyProfile } from '../../data/profiles'

export function HomePage() {
  const { data: profile } = useQuery({ queryKey: ['myProfile'], queryFn: getMyProfile })

  return (
    <div className="min-h-dvh px-5 pt-6">
      <header className="flex items-center justify-between">
        <h1 className="text-[22px] font-bold">모임</h1>
        <Link to="/profile" className="flex items-center gap-2 text-sm text-ink-soft">
          {profile?.avatar_url && (
            <img src={profile.avatar_url} alt="" className="h-8 w-8 rounded-full" />
          )}
          {profile?.display_name}
        </Link>
      </header>

      {/* M2: 그룹 목록 — 지금은 빈 상태만 */}
      <div className="mt-24 text-center">
        <p className="text-base text-ink-soft">아직 모임이 없어요.</p>
        <p className="mt-1 text-sm text-ink-faint">곧 여기서 모임을 만들 수 있어요.</p>
      </div>
    </div>
  )
}
