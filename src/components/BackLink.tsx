import { Link } from 'react-router-dom'

/** 하위 화면 공통 이탈 링크 — 항상 명시적 부모 경로로 이동한다 (navigate(-1) 금지).
 *  deep link·로그인 ?next= 진입처럼 인앱 히스토리가 없는 경우에도 동작해야 하기 때문.
 *  push 이동이므로 브라우저 뒤로가기로 원래 화면 복귀 가능. */
export function BackLink({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className="flex h-11 items-center text-base text-ink-soft">
      ‹ {label}
    </Link>
  )
}
