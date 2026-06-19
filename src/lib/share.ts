export interface ShareDeps {
  /** Web Share API (navigator.share) — 미지원이면 생략 */
  share?: (data: { text: string }) => Promise<void>
  /** 클립보드 복사 폴백 (navigator.clipboard.writeText) */
  copy: (text: string) => Promise<void>
}

/** Web Share로 공유, 미지원·실패·취소 시 클립보드 복사 폴백. */
export async function shareText(text: string, deps: ShareDeps): Promise<'shared' | 'copied'> {
  if (deps.share) {
    try {
      await deps.share({ text })
      return 'shared'
    } catch {
      // 취소·실패 → 복사 폴백
    }
  }
  await deps.copy(text)
  return 'copied'
}
