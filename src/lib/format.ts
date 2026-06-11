const dateFmt = new Intl.DateTimeFormat('ko-KR', {
  month: 'long',
  day: 'numeric',
  weekday: 'short',
})
const dateFmtWithYear = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  weekday: 'short',
})

/** '6월 11일 (목)' — 올해가 아니면 연도 포함 */
export function formatDate(iso: string): string {
  const date = new Date(iso)
  const fmt = date.getFullYear() === new Date().getFullYear() ? dateFmt : dateFmtWithYear
  return fmt.format(date)
}

export function formatDateRange(startIso: string, endIso: string | null): string {
  if (!endIso || formatDate(endIso) === formatDate(startIso)) return formatDate(startIso)
  return `${formatDate(startIso)} ~ ${formatDate(endIso)}`
}

/** '33,300원' (음수는 '-33,300원') */
export function formatKrw(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`
}
