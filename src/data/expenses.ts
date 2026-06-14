import type { Expense } from '@/core/types'
import { supabase } from './supabase'

export interface ExpenseRow {
  id: string
  event_id: string
  payer_id: string
  title: string
  amount: number
  spent_at: string
  created_by: string
  participants: { user_id: string; share_amount: number | null }[]
}

export async function listExpenses(eventId: string): Promise<ExpenseRow[]> {
  const { data, error } = await supabase
    .from('expenses')
    .select('id, event_id, payer_id, title, amount, spent_at, created_by, expense_participants(user_id, share_amount)')
    .eq('event_id', eventId)
    .order('spent_at', { ascending: true })
  if (error) throw error
  return data.map((e) => ({
    ...e,
    participants: e.expense_participants as unknown as ExpenseRow['participants'],
  }))
}

/** DB row → core 정산 입력 타입 */
export function toCoreExpense(row: ExpenseRow): Expense {
  return {
    id: row.id,
    payerId: row.payer_id,
    amount: row.amount,
    participants: row.participants.map((p) => ({
      userId: p.user_id,
      shareAmount: p.share_amount,
    })),
  }
}

export interface ExpenseInput {
  eventId: string
  payerId: string
  title: string
  amount: number
  participantIds: string[]
  /** userId → 고정 부담액. 미포함 인원은 나머지 균등분할 */
  participantShares?: Record<string, number>
}

export async function createExpense(input: ExpenseInput): Promise<void> {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) throw new Error('로그인이 필요합니다.')
  const { data: expense, error } = await supabase
    .from('expenses')
    .insert({
      event_id: input.eventId,
      payer_id: input.payerId,
      title: input.title,
      amount: input.amount,
      created_by: auth.user.id,
    })
    .select('id')
    .single()
  if (error) throw error
  const { error: pError } = await supabase
    .from('expense_participants')
    .insert(
      input.participantIds.map((user_id) => ({
        expense_id: expense.id,
        user_id,
        share_amount: input.participantShares?.[user_id] ?? null,
      })),
    )
  if (pError) throw pError
}

export async function updateExpense(expenseId: string, input: ExpenseInput): Promise<void> {
  const { error } = await supabase
    .from('expenses')
    .update({ payer_id: input.payerId, title: input.title, amount: input.amount })
    .eq('id', expenseId)
  if (error) throw error
  // 참여자는 전체 교체 (행 수가 적어 단순함 우선)
  const { error: dError } = await supabase
    .from('expense_participants')
    .delete()
    .eq('expense_id', expenseId)
  if (dError) throw dError
  const { error: pError } = await supabase
    .from('expense_participants')
    .insert(
      input.participantIds.map((user_id) => ({
        expense_id: expenseId,
        user_id,
        share_amount: input.participantShares?.[user_id] ?? null,
      })),
    )
  if (pError) throw pError
}

export async function deleteExpense(expenseId: string): Promise<void> {
  const { error } = await supabase.from('expenses').delete().eq('id', expenseId)
  if (error) throw error
}

export async function getExpense(expenseId: string): Promise<ExpenseRow> {
  const { data, error } = await supabase
    .from('expenses')
    .select('id, event_id, payer_id, title, amount, spent_at, created_by, expense_participants(user_id, share_amount)')
    .eq('id', expenseId)
    .single()
  if (error) throw error
  return {
    ...data,
    participants: data.expense_participants as unknown as ExpenseRow['participants'],
  }
}
