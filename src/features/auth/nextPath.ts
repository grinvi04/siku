/** 로그인 후 복귀 경로 검증 — 초대 딥링크(/invite/*)만 보존한다.
 *  그 외에는 로그인 후 항상 메인으로: 주 사용자(40~60대)에게 예측 가능한 동선이 우선이고,
 *  오래된 next(만료 세션이 마지막으로 보던 화면 등)로 복귀하면 길을 잃는다.
 *
 *  URL 정규화 후 검증한다 — '/invite/../profile' 같은 dot-segment는 브라우저(history API)가
 *  '/profile'로 풀어버리므로, 정규화 전 prefix 검사만으로는 정책이 우회된다.
 *  정규화된 pathname만 반환하므로 외부 URL·트릭 입력은 모두 무력화된다. */
export function sanitizeNextPath(raw: string | null): string | undefined {
  if (!raw) return undefined
  let path: string
  try {
    path = new URL(raw, 'https://siku.invalid').pathname
  } catch {
    return undefined
  }
  if (!path.startsWith('/invite/')) return undefined
  return path
}
