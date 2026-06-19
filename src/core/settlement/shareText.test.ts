import { describe, expect, it } from 'vitest'
import { formatSettlementText } from './shareText'

describe('formatSettlementText', () => {
  it('AC-1: 모임명 헤더 + 각 이체 줄(이름·금액) + 총 송금건수', () => {
    const text = formatSettlementText({
      groupName: '제주여행',
      lines: [
        { from: '철수', to: '영희', amount: 12000 },
        { from: '민수', to: '영희', amount: 8000 },
      ],
    })
    expect(text).toContain('제주여행')
    expect(text).toContain('철수 → 영희 12,000원')
    expect(text).toContain('민수 → 영희 8,000원')
    expect(text).toContain('2건')
  })

  it('AC-1: 금액은 천단위 콤마(formatKrw)로 표기, 1건이면 "1건"', () => {
    const text = formatSettlementText({
      groupName: 'G',
      lines: [{ from: 'A', to: 'B', amount: 1234567 }],
    })
    expect(text).toContain('1,234,567원')
    expect(text).toContain('1건')
  })

  it('AC-2: 이체 0건이면 빈 안내 텍스트 반환 (크래시 없음)', () => {
    const text = formatSettlementText({ groupName: '제주여행', lines: [] })
    expect(text).toContain('제주여행')
    expect(text).toContain('보낼 송금이 없어요')
  })
})
