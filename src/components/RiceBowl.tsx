/** 김이 모락모락 나는 밥 한 그릇 — 빈 화면·온보딩의 감성 비주얼.
 *  DESIGN.md "따뜻함은 추억에만": 웜 톤(accent)은 이런 정서 영역에만 쓴다. */
export function RiceBowl({ size = 96 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none" aria-hidden="true">
      {/* 김 */}
      <path d="M38 16c-3 5 3 7 0 13" stroke="#e8865d" strokeWidth="3" strokeLinecap="round" opacity="0.4" />
      <path d="M48 10c-3 6 3 9 0 16" stroke="#e8865d" strokeWidth="3" strokeLinecap="round" opacity="0.65" />
      <path d="M58 16c-3 5 3 7 0 13" stroke="#e8865d" strokeWidth="3" strokeLinecap="round" opacity="0.4" />
      {/* 밥 */}
      <ellipse cx="48" cy="45" rx="21" ry="9" fill="#ffffff" stroke="#e5e8eb" strokeWidth="2" />
      {/* 그릇 */}
      <path d="M22 46a26 24 0 0 0 52 0Z" fill="#e8865d" />
      <path d="M24 46h48" stroke="#ffffff" strokeWidth="2" opacity="0.35" />
      {/* 굽 */}
      <rect x="38" y="70" width="20" height="5" rx="2.5" fill="#c96a45" />
    </svg>
  )
}
