/** OCR로 읽은 영수증 텍스트에서 상호명·금액·날짜를 추출한다 (순수 함수 — 결과는 폼 미리 채움용이라 100% 정확하지 않아도 됨) */

export interface ParsedReceipt {
  title: string | null
  amount: number | null
  /** YYYY-MM-DD */
  date: string | null
}

// 우선순위 순서 — 앞의 키워드가 있으면 그 줄의 금액을 채택
const AMOUNT_KEYWORDS = [
  '받을금액',
  '받을 금액',
  '결제금액',
  '결제 금액',
  '주문금액', // 배달앱(쿠팡이츠 등)
  '합계금액',
  '청구금액',
  '합계',
  '합 계',
  '총액',
  '총 액',
  '판매총액',
  '총구매액',
  'total',
]

const TITLE_SKIP = /영수증|매출|신용|카드|승인|사업자|대표자?|전화|주소|TEL|POS|NO[.:]|일시|발행/i

function extractNumbers(line: string): number[] {
  const matches = line.match(/\d{1,3}(?:,\d{3})+|\d+/g) ?? []
  return matches.map((m) => parseInt(m.replaceAll(',', ''), 10))
}

function findAmount(lines: string[]): number | null {
  for (const keyword of AMOUNT_KEYWORDS) {
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].toLowerCase().includes(keyword)) continue
      // 키워드 줄에서 먼저 찾고, 없으면 다음 줄 (OCR이 라벨/값을 줄바꿈하는 경우)
      for (const candidate of [lines[i], lines[i + 1] ?? '']) {
        const nums = extractNumbers(candidate).filter((n) => n >= 100 && n < 100_000_000)
        if (nums.length > 0) return nums[nums.length - 1]
      }
    }
  }
  // 폴백: 콤마 포맷된 숫자 중 최댓값 (사업자번호·카드번호·전화번호는 콤마가 없다)
  const commaNumbers = lines
    .flatMap((line) => line.match(/\d{1,3}(?:,\d{3})+/g) ?? [])
    .map((m) => parseInt(m.replaceAll(',', ''), 10))
    .filter((n) => n >= 100 && n < 100_000_000)
  return commaNumbers.length > 0 ? Math.max(...commaNumbers) : null
}

function findDate(text: string): string | null {
  const match = text.match(/(20\d{2})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/)
  if (!match) return null
  const [, y, m, d] = match
  const month = parseInt(m, 10)
  const day = parseInt(d, 10)
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function findTitle(lines: string[]): string | null {
  // '상호: ...' 라벨이 있으면 최우선
  for (const line of lines) {
    const labeled = line.match(/상호명?\s*[:：]\s*(.+)/)
    if (labeled) return labeled[1].trim().slice(0, 30) || null
  }
  // 없으면 상단 5줄 중 첫 번째 그럴듯한 줄 (가게 이름은 보통 맨 위)
  for (const line of lines.slice(0, 5)) {
    const trimmed = line.trim()
    if (trimmed.length < 2 || trimmed.length > 25) continue
    if (TITLE_SKIP.test(trimmed)) continue
    if (!/[가-힣a-zA-Z]/.test(trimmed)) continue // 숫자·기호뿐인 줄 제외
    const digits = trimmed.replace(/\D/g, '')
    if (digits.length > trimmed.length / 2) continue
    return trimmed.slice(0, 30)
  }
  return null
}

export function parseReceiptText(text: string): ParsedReceipt {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  return {
    title: findTitle(lines),
    amount: findAmount(lines),
    date: findDate(text),
  }
}
