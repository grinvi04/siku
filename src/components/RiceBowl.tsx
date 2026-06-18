/** 김이 모락모락 나는 밥 한 그릇 — 빈 화면·온보딩의 감성 비주얼.
 *  브랜드 그릇 마크(favicon)와 같은 실루엣을 웜 톤으로 — 색 역할만 분리한다.
 *  DESIGN.md "따뜻함은 추억에만": 웜 톤(accent)은 이런 정서 영역에만 쓴다. */
export function RiceBowl({ size = 96 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none" aria-hidden="true">
      {/* 김 — 가운데 길게, 비대칭 리듬 */}
      <path d="M35,20 C32,26 38,30 35,36" stroke="#e8865d" strokeWidth="3" strokeLinecap="round" opacity="0.45" />
      <path d="M48,15 C45,23 51,28 48,35" stroke="#e8865d" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
      <path d="M61,20 C58,26 64,30 61,36" stroke="#e8865d" strokeWidth="3" strokeLinecap="round" opacity="0.45" />
      {/* 그릇 (웜 채움) — 브랜드 마크와 동일 실루엣 */}
      <path d="M21,55 C23,73 37,81 48,81 C59,81 73,73 75,55 Z" fill="#e8865d" />
      {/* 밥 (흰 봉우리, 개구부에) */}
      <path d="M27,55 Q48,46 69,55 Z" fill="#ffffff" />
      {/* 림 하이라이트 */}
      <path d="M23,55 H73" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" opacity="0.35" />
      {/* 굽 */}
      <rect x="40" y="82" width="16" height="4" rx="2" fill="#c96a45" />
    </svg>
  )
}
