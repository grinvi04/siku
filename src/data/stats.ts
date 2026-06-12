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
  /** 장소 이름 → 방문 횟수 (확정된 장소, 2회 이상만 의미) */
  placeCounts: Map<string, number>
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
      .select('amount, events!inner(group_id)')
      .eq('events.group_id', groupId),
    supabase
      .from('photos')
      .select('id, events!inner(group_id)', { count: 'exact', head: true })
      .eq('events.group_id', groupId),
    supabase
      .from('visits')
      .select('name, events!inner(group_id)')
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

  let totalSpent = 0
  for (const e of expenses.data ?? []) {
    totalSpent += e.amount
  }

  const placeCounts = new Map<string, number>()
  for (const v of visits.data ?? []) {
    const name = (v.name ?? '').trim()
    if (!name) continue
    placeCounts.set(name, (placeCounts.get(name) ?? 0) + 1)
  }

  return {
    eventCount: events.data?.length ?? 0,
    typeCounts,
    totalSpent,
    photoCount: photos.count ?? 0,
    visitCount: visits.data?.length ?? 0,
    attendCounts,
    placeCounts,
  }
}
