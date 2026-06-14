/** id 기반 고유색 — 아바타·그룹 카드 등 정체성 표시의 단일 출처 (흰 글자 대비 확보된 팔레트) */
const PALETTE = ['#2A5BD7', '#E8865D', '#2F9E44', '#9C36B5', '#F08C00', '#0CA678', '#E64980']

export function colorOf(id: string): string {
  let hash = 0
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) % 997
  return PALETTE[hash % PALETTE.length]
}

/** 이니셜 한 글자 — slice(0,1)은 서로게이트 페어를, 코드포인트 분해는 ZWJ 복합 이모지·국기를
 *  깨뜨린다. Intl.Segmenter(grapheme)로 사용자가 보는 "한 글자" 단위 그대로 추출. */
const grapheme =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? new Intl.Segmenter('ko', { granularity: 'grapheme' })
    : null

export function initialOf(name: string): string {
  if (grapheme) {
    for (const s of grapheme.segment(name)) return s.segment
    return ''
  }
  return [...name][0] ?? ''
}
