import type { Balances, Transfer } from '../types'

/**
 * 잔액을 최소 이체 목록으로 정리 (greedy: 최대 채무자 ↔ 최대 채권자 반복 매칭, 최대 n−1회).
 * 동률은 userId 정렬순으로 결정적으로 선택한다.
 */
export function simplifyBalances(balances: Balances): Transfer[] {
  const debtors: { userId: string; amount: number }[] = []
  const creditors: { userId: string; amount: number }[] = []
  for (const [userId, balance] of balances) {
    if (balance < 0) debtors.push({ userId, amount: -balance })
    else if (balance > 0) creditors.push({ userId, amount: balance })
  }
  const byAmountThenId = (a: { userId: string; amount: number }, b: typeof a) =>
    b.amount - a.amount || (a.userId < b.userId ? -1 : 1)

  const transfers: Transfer[] = []
  while (debtors.length > 0 && creditors.length > 0) {
    debtors.sort(byAmountThenId)
    creditors.sort(byAmountThenId)
    const debtor = debtors[0]
    const creditor = creditors[0]
    const amount = Math.min(debtor.amount, creditor.amount)
    transfers.push({ fromUser: debtor.userId, toUser: creditor.userId, amount })
    debtor.amount -= amount
    creditor.amount -= amount
    if (debtor.amount === 0) debtors.shift()
    if (creditor.amount === 0) creditors.shift()
  }
  return transfers
}

/**
 * 이체 금액을 단위(기본 100원)로 반올림. 차액은 채권자가 부담/이득한다.
 * 반올림 후 0원이 된 이체는 제거.
 */
export function roundTransfers(transfers: Transfer[], unit = 100): Transfer[] {
  return transfers
    .map((t) => ({ ...t, amount: Math.round(t.amount / unit) * unit }))
    .filter((t) => t.amount > 0)
}

/** 잔액 → 100원 반올림된 최종 이체 목록 (UI·close_settlement에 전달하는 값) */
export function settle(balances: Balances): Transfer[] {
  return roundTransfers(simplifyBalances(balances))
}
