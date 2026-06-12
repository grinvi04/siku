/** 로그인 후 복귀 경로 검증 — 앱 내부 경로만 허용 (open redirect 방지) */
export function sanitizeNextPath(raw: string | null): string | undefined {
  if (!raw) return undefined
  if (!raw.startsWith('/') || raw.startsWith('//')) return undefined
  return raw
}
