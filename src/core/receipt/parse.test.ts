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

  it('콤마 없이 원 접미사만 있는 금액도 폴백으로 잡는다', () => {
    const text = `분식왕\n김밥 3500원\n라면 4500원\n8000원`
    expect(parseReceiptText(text).amount).toBe(8000)
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

  it('실제 OCR 결과: 키워드 다음 줄이 날짜여도 금액으로 오인하지 않는다', () => {
    // 회전·흔들린 사진의 실제 Vision OCR 출력 — 날짜를 '20026-06-08'로 오독한 케이스
    const text = `coupang eats\n[매장용]\n메뉴\nJE\nICE\n26P56K\n[수저포크]\n수량 금액\n햄치즈 샌드위치+커피세 1 10,500\n주문금액\n거래일시: 20026-06-08 20:06:08\n0\n10,500`
    const result = parseReceiptText(text)
    expect(result.amount).toBe(10500)
    expect(result.title).toBe('coupang eats')
  })

  it('마스킹된 카드번호·사업자번호는 금액 후보가 아니다 (콤마·원 없음)', () => {
    const text = `구이집\n카드번호: 1234-56**-****-7890\n123-45-67890\n저녁 15,000`
    expect(parseReceiptText(text).amount).toBe(15000)
  })

  it('부가세 분리 영수증: 합계가 공급가액·세액보다 우선', () => {
    const text = `식당\n공급가액 9,091\n부가세 909\n합계 10,000`
    expect(parseReceiptText(text).amount).toBe(10000)
  })

  it('합계 줄에 건수 등 다른 숫자가 섞여도 마지막 숫자(금액 열)를 채택', () => {
    expect(parseReceiptText('합계 3 45,000').amount).toBe(45000)
  })

  it('첫 줄이 전화번호면 다음 줄에서 상호를 찾는다', () => {
    const text = `02-1234-5678\n바다회집\n합계 88,000`
    expect(parseReceiptText(text).title).toBe('바다회집')
  })

  it('영문 영수증: TOTAL 키워드와 영문 상호', () => {
    const result = parseReceiptText('STARBUCKS\nAmericano 2\nTOTAL 12,500')
    expect(result.amount).toBe(12500)
    expect(result.title).toBe('STARBUCKS')
  })

  it('금액이 100원 미만뿐이면 null', () => {
    expect(parseReceiptText('주차 도장\n확인 50원').amount).toBeNull()
  })

  it('두 자리 연도(26-06-08)는 날짜로 인식하지 않는다 (오인 방지)', () => {
    expect(parseReceiptText('거래일: 26-06-08').date).toBeNull()
  })

  it('배달앱 영수증: 주문금액 키워드 + 상호 첫 줄', () => {
    const text = `coupang eats\n26P56K\n[수저포크O]\n메뉴 수량 금액\n더블 햄치즈 샌드위치+커피세트 1 10,500\n* ICE 1 0\n주문금액 10,500\n거래일시: 2026-06-08 20:05:09`
    const result = parseReceiptText(text)
    expect(result.amount).toBe(10500)
    expect(result.title).toBe('coupang eats')
    expect(result.date).toBe('2026-06-08')
  })
})
