import { formatKrw } from '@/lib/format'

export interface ShareLine {
  from: string
  to: string
  amount: number
}

/** 확정 정산 이체 목록을 모임 채팅 공유용 텍스트로 묶는다 (순수 — 플랫폼 API 없음). */
export function formatSettlementText({
  groupName,
  lines,
}: {
  groupName: string
  lines: ShareLine[]
}): string {
  const header = `[${groupName}] 정산 결과`
  if (lines.length === 0) {
    return `${header}\n보낼 송금이 없어요`
  }
  const body = lines.map((l) => `${l.from} → ${l.to} ${formatKrw(l.amount)}`).join('\n')
  return `${header}\n${body}\n\n송금 ${lines.length}건`
}
