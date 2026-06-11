import { describe, expect, it } from 'vitest'
import type { Expense } from '../types'
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
    expect(() => splitExpense(exp('e', 'a', 1000, [['a', 300], ['b', 300]]))).toThrow()
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
