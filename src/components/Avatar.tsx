// 멤버 이니셜 아바타 — 사용자 id로 결정되는 고유색 (흰 글자 대비 확보된 팔레트)
const PALETTE = ['#2A5BD7', '#E8865D', '#2F9E44', '#9C36B5', '#F08C00', '#0CA678', '#E64980']

function colorOf(id: string): string {
  let hash = 0
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) % 997
  return PALETTE[hash % PALETTE.length]
}

export function Avatar({ name, id, size = 28 }: { name: string; id: string; size?: number }) {
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{ width: size, height: size, backgroundColor: colorOf(id), fontSize: size * 0.46 }}
    >
      {name.slice(0, 1)}
    </span>
  )
}
