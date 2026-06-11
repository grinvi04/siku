import type { Transfer } from '@/core/types'
import { supabase } from './supabase'

export type TransferStatus = 'pending' | 'sent' | 'confirmed'

export interface TransferRow {
  id: string
  from_user: string
  to_user: string
  amount: number
  status: TransferStatus
}

export interface ClosedSettlement {
  id: string
  created_at: string
  transfers: TransferRow[]
}

/** 현재 유효한(확정된) 정산. 없으면 null */
export async function getClosedSettlement(eventId: string): Promise<ClosedSettlement | null> {
  const { data, error } = await supabase
    .from('settlements')
    .select('id, created_at, settlement_transfers(id, from_user, to_user, amount, status)')
    .eq('event_id', eventId)
    .eq('status', 'closed')
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return {
    id: data.id,
    created_at: data.created_at,
    transfers: data.settlement_transfers as unknown as TransferRow[],
  }
}

/**
 * 이전 확정(reopened)에서 이미 수령 확인된 이체 — 재확정 시 선지급으로 차감한다.
 * (sent는 받는 쪽 확인 전이므로 제외 — 분쟁 여지를 남기지 않음)
 */
export async function getPrepaidTransfers(eventId: string): Promise<Transfer[]> {
  const { data, error } = await supabase
    .from('settlements')
    .select('settlement_transfers(from_user, to_user, amount, status)')
    .eq('event_id', eventId)
    .eq('status', 'reopened')
  if (error) throw error
  return data
    .flatMap((s) => s.settlement_transfers as unknown as TransferRow[])
    .filter((t) => t.status === 'confirmed')
    .map((t) => ({ fromUser: t.from_user, toUser: t.to_user, amount: t.amount }))
}

export async function closeSettlement(eventId: string, transfers: Transfer[]): Promise<void> {
  const { error } = await supabase.rpc('close_settlement', {
    p_event_id: eventId,
    p_transfers: transfers.map((t) => ({
      from_user: t.fromUser,
      to_user: t.toUser,
      amount: t.amount,
    })),
  })
  if (error) throw error
}

export async function reopenSettlement(eventId: string): Promise<void> {
  const { error } = await supabase.rpc('reopen_settlement', { p_event_id: eventId })
  if (error) throw error
}

export async function markTransfer(transferId: string, status: 'sent' | 'confirmed'): Promise<void> {
  const { error } = await supabase
    .from('settlement_transfers')
    .update({ status })
    .eq('id', transferId)
  if (error) throw error
}

export interface AccountInfo {
  id: string
  display_name: string
  bank_name: string | null
  account_number: string | null
  account_holder: string | null
}

/** 이체 받는 사람들의 계좌 정보 (같은 그룹 멤버는 RLS로 조회 가능) */
export async function getAccounts(userIds: string[]): Promise<Map<string, AccountInfo>> {
  if (userIds.length === 0) return new Map()
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, bank_name, account_number, account_holder')
    .in('id', userIds)
  if (error) throw error
  return new Map(data.map((p) => [p.id, p]))
}
