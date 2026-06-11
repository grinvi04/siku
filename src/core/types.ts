/** 금액은 모두 KRW 정수(원). 음수 지출 = 환불·환급. */

export interface Expense {
  id: string
  payerId: string
  amount: number
  /** 분할 대상. shareAmount가 null이면 균등분할 */
  participants: { userId: string; shareAmount: number | null }[]
}

/** 멤버별 순잔액. 양수 = 받을 돈, 음수 = 낼 돈 */
export type Balances = Map<string, number>

export interface Transfer {
  fromUser: string
  toUser: string
  amount: number
}

export interface PhotoPoint {
  id: string
  lat: number
  lng: number
  /** epoch ms */
  takenAt: number
}

export interface StayPoint {
  lat: number
  lng: number
  /** epoch ms */
  startedAt: number
  endedAt: number
  photoIds: string[]
}
