import { describe, expect, it } from 'vitest'
import type { Expense } from '@/core/types'
import { computeBalances } from './balance'
import { roundTransfers, simplifyBalances, settle } from './simplify'
import { splitExpense } from './split'

const exp = (
  id: string,
  payerId: string,
  amount: number,
  participants: (string | [string, number])[],
): Expense => ({
  id,
  payerId,
  amount,
  participants: participants.map((p) =>
    typeof p === 'string' ? { userId: p, shareAmount: null } : { userId: p[0], shareAmount: p[1] },
  ),
})

describe('splitExpense', () => {
  it('균등분할: 나머지는 userId 정렬순으로 +1원 (결정적)', () => {
    const shares = splitExpense(exp('e1', 'a', 100000, ['c', 'a', 'b']))
    expect(shares.get('a')).toBe(33334)
    expect(shares.get('b')).toBe(33333)
    expect(shares.get('c')).toBe(33333)
  })

  it('명시 부담액 + 잔액 균등분할', () => {
    // b는 술을 안 마셔 10,000원만 부담, 나머지 90,000원을 a·c가 45,000원씩
    const shares = splitExpense(exp('e1', 'a', 100000, [['b', 10000], 'a', 'c']))
    expect(shares.get('b')).toBe(10000)
    expect(shares.get('a')).toBe(45000)
    expect(shares.get('c')).toBe(45000)
  })

  it('음수 지출(환불): 부담액도 음수로 분배', () => {
    const shares = splitExpense(exp('e1', 'a', -30000, ['a', 'b', 'c']))
    expect(shares.get('a')).toBe(-10000)
    expect(shares.get('b')).toBe(-10000)
    expect(shares.get('c')).toBe(-10000)
  })

  it('음수 지출의 나머지도 결정적으로 분배되고 합계가 보존된다', () => {
    const shares = splitExpense(exp('e1', 'a', -100, ['a', 'b', 'c']))
    const total = [...shares.values()].reduce((s, v) => s + v, 0)
    expect(total).toBe(-100)
    expect(shares.get('a')).toBe(-34)
  })

  it('검증: 0원 지출, 참여자 없음, 중복 참여자, 명시분 초과', () => {
    expect(() => splitExpense(exp('e', 'a', 0, ['a']))).toThrow()
    expect(() => splitExpense(exp('e', 'a', 1000, []))).toThrow()
    expect(() => splitExpense(exp('e', 'a', 1000, ['a', 'a']))).toThrow()
    expect(() => splitExpense(exp('e', 'a', 1000, [['b', 2000], 'a']))).toThrow()
    // 전원 명시인데 합계 불일치
    expect(() =>
      splitExpense(
        exp('e', 'a', 1000, [
          ['a', 300],
          ['b', 300],
        ]),
      ),
    ).toThrow()
  })
})

describe('computeBalances', () => {
  it('결제자가 참여자가 아닌 지출: 결제자는 전액 채권', () => {
    const balances = computeBalances([exp('e1', 'a', 30000, ['b', 'c'])])
    expect(balances.get('a')).toBe(30000)
    expect(balances.get('b')).toBe(-15000)
    expect(balances.get('c')).toBe(-15000)
  })

  it('여러 지출·결제자 합산 후 합계 0', () => {
    const balances = computeBalances([
      exp('e1', 'a', 90000, ['a', 'b', 'c']),
      exp('e2', 'b', 30000, ['a', 'b', 'c']),
    ])
    expect(balances.get('a')).toBe(60000 - 10000)
    expect(balances.get('b')).toBe(-30000 + 20000)
    expect(balances.get('c')).toBe(-40000)
    expect([...balances.values()].reduce((s, v) => s + v, 0)).toBe(0)
  })

  it('선지급(confirmed 이체) 차감: 보낸 사람은 가산, 받은 사람은 차감', () => {
    const expenses = [exp('e1', 'a', 90000, ['a', 'b', 'c'])]
    // b가 이전 확정에서 이미 30,000원을 a에게 보냄
    const balances = computeBalances(expenses, [{ fromUser: 'b', toUser: 'a', amount: 30000 }])
    expect(balances.get('b')).toBe(0)
    expect(balances.get('a')).toBe(30000)
    expect(balances.get('c')).toBe(-30000)
  })

  it('환불 지출이 섞여도 합계 0 유지', () => {
    const balances = computeBalances([
      exp('e1', 'a', 100000, ['a', 'b']),
      exp('e2', 'a', -20000, ['a', 'b']), // 보증금 환급
    ])
    expect(balances.get('a')).toBe(40000)
    expect(balances.get('b')).toBe(-40000)
  })
})

describe('simplifyBalances', () => {
  it('n명 잔액을 최대 n−1회 이체로 정리', () => {
    const balances = new Map([
      ['a', 60000],
      ['b', -10000],
      ['c', -20000],
      ['d', -30000],
    ])
    const transfers = simplifyBalances(balances)
    expect(transfers.length).toBeLessThanOrEqual(3)
    // 이체 적용 후 모든 잔액 0
    const after = new Map(balances)
    for (const t of transfers) {
      after.set(t.fromUser, (after.get(t.fromUser) ?? 0) + t.amount)
      after.set(t.toUser, (after.get(t.toUser) ?? 0) - t.amount)
    }
    expect([...after.values()].every((v) => v === 0)).toBe(true)
  })

  it('잔액 0인 멤버는 이체에 등장하지 않는다', () => {
    const transfers = simplifyBalances(
      new Map([
        ['a', 10000],
        ['b', -10000],
        ['c', 0],
      ]),
    )
    expect(transfers).toEqual([{ fromUser: 'b', toUser: 'a', amount: 10000 }])
  })

  it('동률 잔액에서도 결과가 결정적이다', () => {
    const make = () =>
      simplifyBalances(
        new Map([
          ['b', -5000],
          ['a', -5000],
          ['c', 10000],
        ]),
      )
    expect(make()).toEqual(make())
    expect(make()[0].fromUser).toBe('a')
  })
})

describe('splitExpense — 경계·속성', () => {
  it('참여자 1명이면 전액 부담', () => {
    expect(splitExpense(exp('e', 'a', 99999, ['b'])).get('b')).toBe(99999)
  })

  it('전원 명시이고 합계가 정확히 일치하면 그대로 채택', () => {
    const shares = splitExpense(
      exp('e', 'a', 1000, [
        ['a', 700],
        ['b', 300],
      ]),
    )
    expect(shares.get('a')).toBe(700)
    expect(shares.get('b')).toBe(300)
  })

  it('명시 0원 부담 허용 (기록용 참여자)', () => {
    const shares = splitExpense(exp('e', 'a', 30000, [['c', 0], 'a', 'b']))
    expect(shares.get('c')).toBe(0)
    expect(shares.get('a')).toBe(15000)
  })

  it('음수 지출 + 명시 부담액 혼합', () => {
    // 보증금 -30,000 중 b는 -10,000만 돌려받고 나머지는 a·c가 나눔
    const shares = splitExpense(exp('e', 'a', -30000, [['b', -10000], 'a', 'c']))
    expect(shares.get('b')).toBe(-10000)
    expect(shares.get('a')).toBe(-10000)
    expect(shares.get('c')).toBe(-10000)
  })

  it('속성: 어떤 인원·금액 조합이든 부담액 합계 = 지출액', () => {
    const amounts = [100, 101, 7777, 99_999, 12_345_678, -100, -99_999]
    const headcounts = [1, 2, 3, 6, 7, 9, 10]
    for (const amount of amounts) {
      for (const n of headcounts) {
        const ids = Array.from({ length: n }, (_, i) => `u${i}`)
        const shares = splitExpense(exp('e', 'u0', amount, ids))
        const total = [...shares.values()].reduce((s, v) => s + v, 0)
        expect(total, `amount=${amount} n=${n}`).toBe(amount)
        // 균등분할이므로 부담액 격차는 최대 1원
        const values = [...shares.values()]
        expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(1)
      }
    }
  })
})

describe('computeBalances — 경계', () => {
  it('지출이 없으면 빈 잔액', () => {
    expect(computeBalances([]).size).toBe(0)
  })

  it('선지급만 있어도 합계는 0', () => {
    const balances = computeBalances([], [{ fromUser: 'a', toUser: 'b', amount: 5000 }])
    expect(balances.get('a')).toBe(5000)
    expect(balances.get('b')).toBe(-5000)
  })
})

describe('simplifyBalances — 경계·속성', () => {
  const applyTransfers = (
    balances: Map<string, number>,
    transfers: ReturnType<typeof simplifyBalances>,
  ) => {
    const after = new Map(balances)
    for (const t of transfers) {
      after.set(t.fromUser, (after.get(t.fromUser) ?? 0) + t.amount)
      after.set(t.toUser, (after.get(t.toUser) ?? 0) - t.amount)
    }
    return after
  }

  it('모든 잔액이 0이면 빈 목록', () => {
    expect(
      simplifyBalances(
        new Map([
          ['a', 0],
          ['b', 0],
        ]),
      ),
    ).toEqual([])
  })

  it('채권자 2 채무자 3 — 적용 후 전원 0', () => {
    const balances = new Map([
      ['a', 45000],
      ['b', 15000],
      ['c', -10000],
      ['d', -20000],
      ['e', -30000],
    ])
    const transfers = simplifyBalances(balances)
    expect(transfers.length).toBeLessThanOrEqual(4)
    expect([...applyTransfers(balances, transfers).values()].every((v) => v === 0)).toBe(true)
  })

  it('10명 복합 — 이체 수 ≤ 9, 적용 후 전원 0', () => {
    const balances = new Map([
      ['u0', 123400],
      ['u1', -56700],
      ['u2', 8900],
      ['u3', -1200],
      ['u4', -74400],
      ['u5', 31000],
      ['u6', -45000],
      ['u7', 99000],
      ['u8', -85000],
      ['u9', 0],
    ])
    expect([...balances.values()].reduce((s, v) => s + v, 0)).toBe(0)
    const transfers = simplifyBalances(balances)
    expect(transfers.length).toBeLessThanOrEqual(9)
    expect([...applyTransfers(balances, transfers).values()].every((v) => v === 0)).toBe(true)
    expect(transfers.every((t) => t.amount > 0)).toBe(true)
  })
})

describe('roundTransfers — 경계값', () => {
  it('50원은 올림, 49원은 버림 (반올림)', () => {
    const rounded = roundTransfers([
      { fromUser: 'a', toUser: 'x', amount: 33350 },
      { fromUser: 'b', toUser: 'x', amount: 33349 },
    ])
    expect(rounded[0].amount).toBe(33400)
    expect(rounded[1].amount).toBe(33300)
  })

  it('반올림 오차는 이체당 최대 50원', () => {
    for (const amount of [101, 149, 150, 5049, 5050, 999_950]) {
      const [t] = roundTransfers([{ fromUser: 'a', toUser: 'b', amount }])
      expect(Math.abs(t.amount - amount)).toBeLessThanOrEqual(50)
    }
  })

  it('100원 미만 이체만 있으면 빈 결과 (보낼 게 없음)', () => {
    expect(roundTransfers([{ fromUser: 'a', toUser: 'b', amount: 49 }])).toEqual([])
  })
})

describe('settle 통합 — 여행 시나리오 (숙소·식사·환불·선지급)', () => {
  it('복합 입력에서도 최소 이체로 정확히 정리된다', () => {
    const expenses = [
      exp('숙소', 'a', 240000, ['a', 'b', 'c', 'd']),
      exp('식사', 'b', 80000, ['a', 'b', 'c', 'd']),
      exp('보증금환급', 'a', -40000, ['a', 'b', 'c', 'd']),
    ]
    // 이전 확정에서 c가 a에게 50,000원을 이미 보냄 (재확정 케이스)
    const balances = computeBalances(expenses, [{ fromUser: 'c', toUser: 'a', amount: 50000 }])
    expect(balances.get('a')).toBe(80000)
    expect(balances.get('b')).toBe(10000)
    expect(balances.get('c')).toBe(-20000)
    expect(balances.get('d')).toBe(-70000)

    const transfers = settle(balances)
    expect(transfers).toHaveLength(3)
    expect(transfers).toContainEqual({ fromUser: 'd', toUser: 'a', amount: 70000 })
    expect(transfers).toContainEqual({ fromUser: 'c', toUser: 'a', amount: 10000 })
    expect(transfers).toContainEqual({ fromUser: 'c', toUser: 'b', amount: 10000 })
  })
})

describe('roundTransfers / settle', () => {
  it('100원 단위 반올림, 0원이 되면 제거', () => {
    const rounded = roundTransfers([
      { fromUser: 'a', toUser: 'b', amount: 33333 },
      { fromUser: 'c', toUser: 'b', amount: 49 },
    ])
    expect(rounded).toEqual([{ fromUser: 'a', toUser: 'b', amount: 33300 }])
  })

  it('통합: 10만원 3인 N분의1 → 33,300원씩 송금', () => {
    const balances = computeBalances([exp('e1', 'a', 100000, ['a', 'b', 'c'])])
    const transfers = settle(balances)
    expect(transfers).toHaveLength(2)
    for (const t of transfers) {
      expect(t.toUser).toBe('a')
      expect(t.amount).toBe(33300) // 33,333/33,334 → 반올림, 차액은 a(채권자) 부담
    }
  })
})
