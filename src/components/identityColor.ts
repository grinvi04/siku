/** id 기반 고유색 — 아바타·그룹 카드 등 정체성 표시의 단일 출처 (흰 글자 대비 확보된 팔레트) */
const PALETTE = ['#2A5BD7', '#E8865D', '#2F9E44', '#9C36B5', '#F08C00', '#0CA678', '#E64980']

export function colorOf(id: string): string {
  let hash = 0
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) % 997
  return PALETTE[hash % PALETTE.length]
}
