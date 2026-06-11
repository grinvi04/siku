import type { StayPoint } from '@/core/types'
import { supabase } from './supabase'

export type VisitStatus = 'suggested' | 'confirmed' | 'rejected'

export interface VisitRow {
  id: string
  event_id: string
  name: string | null
  lat: number | null
  lng: number | null
  radius_m: number
  started_at: string
  ended_at: string
  source: 'auto' | 'manual'
  status: VisitStatus
  order_index: number
}

export async function listVisits(eventId: string): Promise<VisitRow[]> {
  const { data, error } = await supabase
    .from('visits')
    .select('*')
    .eq('event_id', eventId)
    .order('started_at', { ascending: true })
  if (error) throw error
  return data
}

/**
 * 자동 인식 결과를 갱신한다 — 기존 suggested(auto)를 지우고 새 제안으로 교체.
 * confirmed·manual·rejected는 건드리지 않는다 (멱등 재실행).
 */
export async function replaceSuggestedVisits(
  eventId: string,
  stayPoints: StayPoint[],
): Promise<number> {
  const { error: deleteError } = await supabase
    .from('visits')
    .delete()
    .eq('event_id', eventId)
    .eq('status', 'suggested')
    .eq('source', 'auto')
  if (deleteError) throw deleteError
  if (stayPoints.length === 0) return 0

  const { error } = await supabase.from('visits').insert(
    stayPoints.map((sp, index) => ({
      event_id: eventId,
      lat: sp.lat,
      lng: sp.lng,
      started_at: new Date(sp.startedAt).toISOString(),
      ended_at: new Date(sp.endedAt).toISOString(),
      source: 'auto',
      status: 'suggested',
      order_index: index,
    })),
  )
  if (error) throw error
  return stayPoints.length
}

export async function confirmVisit(visitId: string, name: string): Promise<void> {
  const { error } = await supabase
    .from('visits')
    .update({ status: 'confirmed', name: name.trim() || null })
    .eq('id', visitId)
  if (error) throw error
}

export async function rejectVisit(visitId: string): Promise<void> {
  const { error } = await supabase.from('visits').update({ status: 'rejected' }).eq('id', visitId)
  if (error) throw error
}

export async function deleteVisit(visitId: string): Promise<void> {
  const { error } = await supabase.from('visits').delete().eq('id', visitId)
  if (error) throw error
}

export async function addManualVisit(input: {
  eventId: string
  name: string
  startedAt: string
  endedAt: string
}): Promise<void> {
  const { error } = await supabase.from('visits').insert({
    event_id: input.eventId,
    name: input.name,
    started_at: input.startedAt,
    ended_at: input.endedAt,
    source: 'manual',
    status: 'confirmed',
    order_index: 999,
  })
  if (error) throw error
}
