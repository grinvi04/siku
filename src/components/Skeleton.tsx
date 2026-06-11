/** 로딩 자리 표시 — '불러오는 중…' 텍스트 대신 콘텐츠 형태를 미리 보여준다 */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-surface ${className}`} />
}

export function CardListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="mt-5 space-y-2.5">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="h-[76px] rounded-2xl" />
      ))}
    </div>
  )
}
