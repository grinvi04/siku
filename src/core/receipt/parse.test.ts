import { describe, expect, it } from 'vitest'
import { parseReceiptText } from './parse'

describe('parseReceiptText', () => {
  it('일반 식당 영수증: 상호·합계·날짜', () => {
    const text = `
맛나식당
사업자번호: 123-45-67890
대표: 홍길동  TEL: 02-1234-5678
2026-06-10 19:42
삼겹살 2인분        36,000
공기밥 2            2,000
소주 1              5,000
합계               43,000
카드승인 43,000원
`
    const result = parseReceiptText(text)
    expect(result.title).toBe('맛나식당')
    expect(result.amount).toBe(43000)
    expect(result.date).toBe('2026-06-10')
  })

  it('라벨과 금액이 줄바꿈으로 분리된 경우', () => {
    const text = `카페 모임\n2026.05.02\n아메리카노 4\n받을금액\n18,000원`
    const result = parseReceiptText(text)
    expect(result.amount).toBe(18000)
    expect(result.date).toBe('2026-05-02')
  })

  it('상호: 라벨이 있으면 최우선', () => {
    const text = `*** 영수증 ***\n상호: 제주옥돔하우스\n합계 120,000`
    expect(parseReceiptText(text).title).toBe('제주옥돔하우스')
  })

  it('합계 키워드가 없으면 콤마 숫자 최댓값 (사업자·전화번호는 무시)', () => {
    const text = `구이마을\n123-45-67890\n안주 23,000\n주류 12,000\n35,000`
    expect(parseReceiptText(text).amount).toBe(35000)
  })

  it('한국어 날짜 표기(년월일)도 인식', () => {
    expect(parseReceiptText('2026년 6월 9일 결제').date).toBe('2026-06-09')
  })

  it('읽을 게 없으면 전부 null', () => {
    const result = parseReceiptText('---\n###')
    expect(result).toEqual({ title: null, amount: null, date: null })
  })

  it('결제금액이 합계보다 우선한다 (할인 반영 후 실결제액)', () => {
    const text = `식당\n합계 50,000\n할인 -5,000\n결제금액 45,000`
    expect(parseReceiptText(text).amount).toBe(45000)
  })
})
