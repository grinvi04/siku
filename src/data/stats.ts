import type { EventType } from './events'
import { supabase } from './supabase'

export interface GroupStats {
  eventCount: number
  typeCounts: Partial<Record<EventType, number>>
  totalSpent: number
  photoCount: number
  visitCount: number
  /** user_id → 참석 횟수 */
  attendCounts: Map<string, number>
  /** user_id → 결제 합계 (양수 지출만) */
  paidSums: Map<string, number>
}

export async function getGroupStats(groupId: string): Promise<GroupStats> {
  const [events, participants, expenses, photos, visits] = await Promise.all([
    supabase.from('events').select('id, type').eq('group_id', groupId),
    supabase
      .from('event_participants')
      .select('user_id, events!inner(group_id)')
      .eq('events.group_id', groupId),
    supabase
      .from('expenses')
      .select('payer_id, amount, events!inner(group_id)')
      .eq('events.group_id', groupId),
    supabase
      .from('photos')
      .select('id, events!inner(group_id)', { count: 'exact', head: true })
      .eq('events.group_id', groupId),
    supabase
      .from('visits')
      .select('id, events!inner(group_id)', { count: 'exact', head: true })
      .eq('events.group_id', groupId)
      .eq('status', 'confirmed'),
  ])
  for (const r of [events, participants, expenses, photos, visits]) {
    if (r.error) throw r.error
  }

  const typeCounts: Partial<Record<EventType, number>> = {}
  for (const e of events.data ?? []) {
    const t = e.type as EventType
    typeCounts[t] = (typeCounts[t] ?? 0) + 1
  }

  const attendCounts = new Map<string, number>()
  for (const p of participants.data ?? []) {
    attendCounts.set(p.user_id, (attendCounts.get(p.user_id) ?? 0) + 1)
  }

  const paidSums = new Map<string, number>()
  let totalSpent = 0
  for (const e of expenses.data ?? []) {
    totalSpent += e.amount
    if (e.amount > 0) {
      paidSums.set(e.payer_id, (paidSums.get(e.payer_id) ?? 0) + e.amount)
    }
  }

  return {
    eventCount: events.data?.length ?? 0,
    typeCounts,
    totalSpent,
    photoCount: photos.count ?? 0,
    visitCount: visits.count ?? 0,
    attendCounts,
    paidSums,
  }
}
