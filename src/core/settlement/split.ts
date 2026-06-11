import type { Expense } from '../types'

/**
 * 지출 1건을 참여자별 부담액으로 분할한다.
 * - shareAmount 명시분은 그대로, 나머지는 잔액을 균등분할
 * - 원 단위 나머지는 userId 정렬순으로 앞에서부터 1원씩 — 재계산해도 결과가 같다(결정적)
 * - 음수 지출(환불·환급)은 부담액도 음수(돌려받는 돈)로 동일하게 처리
 */
export function splitExpense(expense: Expense): Map<string, number> {
  const { amount, participants } = expense
  if (amount === 0) throw new Error('0원 지출은 허용되지 않습니다.')
  if (participants.length === 0) throw new Error('참여자가 없는 지출입니다.')

  const ids = new Set(participants.map((p) => p.userId))
  if (ids.size !== participants.length) throw new Error('참여자가 중복되었습니다.')

  const explicit = participants.filter((p) => p.shareAmount !== null)
  const equal = participants.filter((p) => p.shareAmount === null)
  const explicitSum = explicit.reduce((s, p) => s + (p.shareAmount as number), 0)
  const remaining = amount - explicitSum

  if (equal.length === 0) {
    if (remaining !== 0) throw new Error('명시 부담액 합계가 지출 금액과 다릅니다.')
  } else if (amount > 0 ? remaining < 0 : remaining > 0) {
    throw new Error('명시 부담액 합계가 지출 금액을 초과합니다.')
  }

  const shares = new Map<string, number>()
  for (const p of explicit) shares.set(p.userId, p.shareAmount as number)

  if (equal.length > 0) {
    const base = Math.trunc(remaining / equal.length)
    let leftover = remaining - base * equal.length // |leftover| < equal.length, remaining과 같은 부호
    const step = Math.sign(leftover)
    const sorted = [...equal].sort((a, b) => (a.userId < b.userId ? -1 : 1))
    for (const p of sorted) {
      let share = base
      if (leftover !== 0) {
        share += step
        leftover -= step
      }
      shares.set(p.userId, share)
    }
  }
  return shares
}
