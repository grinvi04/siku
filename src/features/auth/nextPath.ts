/** 로그인 후 복귀 경로 검증 — 초대 딥링크(/invite/*)만 보존한다.
 *  그 외에는 로그인 후 항상 메인으로: 주 사용자(40~60대)에게 예측 가능한 동선이 우선이고,
 *  오래된 next(만료 세션이 마지막으로 보던 화면 등)로 복귀하면 길을 잃는다.
 *  내부 경로만 허용하므로 open redirect 방지를 겸한다. */
export function sanitizeNextPath(raw: string | null): string | undefined {
  if (!raw) return undefined
  if (!raw.startsWith('/invite/')) return undefined
  return raw
}
