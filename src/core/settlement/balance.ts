import type { Balances, Expense, Transfer } from '@/core/types'
import { splitExpense } from './split'

/**
 * 멤버별 순잔액 계산. 양수 = 받을 돈, 음수 = 낼 돈.
 * @param prepaid 이전 확정(reopened)에서 이미 수령 확인된(confirmed) 이체 —
 *                보낸 사람은 이미 낸 돈으로 가산, 받은 사람은 차감 (선지급 차감)
 */
export function computeBalances(expenses: Expense[], prepaid: Transfer[] = []): Balances {
  const balances: Balances = new Map()
  const add = (userId: string, delta: number) =>
    balances.set(userId, (balances.get(userId) ?? 0) + delta)

  for (const expense of expenses) {
    add(expense.payerId, expense.amount)
    for (const [userId, share] of splitExpense(expense)) add(userId, -share)
  }
  for (const t of prepaid) {
    add(t.fromUser, t.amount)
    add(t.toUser, -t.amount)
  }

  const sum = [...balances.values()].reduce((s, v) => s + v, 0)
  if (sum !== 0) throw new Error(`잔액 합계가 0이 아닙니다: ${sum}`)
  return balances
}
