import { supabase } from './supabase'

export type EventType = 'lunch' | 'dinner' | 'snack' | 'ride' | 'outing' | 'trip'

export const EVENT_TYPE_LABEL: Record<EventType, string> = {
  lunch: '점심모임',
  dinner: '저녁모임',
  snack: '간식·카페',
  ride: '라이딩',
  outing: '나들이',
  trip: '여행',
}

export interface EventSummary {
  id: string
  title: string
  type: EventType
  starts_at: string
  ends_at: string | null
  participant_count: number
}

export interface EventDetail {
  id: string
  group_id: string
  title: string
  type: EventType
  starts_at: string
  ends_at: string | null
  created_by: string
  participants: { user_id: string; display_name: string; avatar_url: string | null }[]
}

export async function listEvents(groupId: string): Promise<EventSummary[]> {
  const { data, error } = await supabase
    .from('events')
    .select('id, title, type, starts_at, ends_at, event_participants(count)')
    .eq('group_id', groupId)
    .order('starts_at', { ascending: false })
  if (error) throw error
  return data.map((e) => ({
    id: e.id,
    title: e.title,
    type: e.type as EventType,
    starts_at: e.starts_at,
    ends_at: e.ends_at,
    participant_count: (e.event_participants as unknown as { count: number }[])[0]?.count ?? 0,
  }))
}

export async function getEvent(eventId: string): Promise<EventDetail> {
  const { data, error } = await supabase
    .from('events')
    .select(
      'id, group_id, title, type, starts_at, ends_at, created_by, event_participants(user_id, profile:profiles(display_name, avatar_url))',
    )
    .eq('id', eventId)
    .single()
  if (error) throw error
  const participants = (
    data.event_participants as unknown as {
      user_id: string
      profile: { display_name: string; avatar_url: string | null }
    }[]
  ).map((p) => ({ user_id: p.user_id, ...p.profile }))
  return {
    id: data.id,
    group_id: data.group_id,
    title: data.title,
    type: data.type as EventType,
    starts_at: data.starts_at,
    ends_at: data.ends_at,
    created_by: data.created_by,
    participants,
  }
}

export async function updateEvent(
  eventId: string,
  patch: { title: string; type: EventType; startsAt: string; endsAt: string | null },
): Promise<void> {
  const { error } = await supabase
    .from('events')
    .update({
      title: patch.title,
      type: patch.type,
      starts_at: patch.startsAt,
      ends_at: patch.endsAt,
    })
    .eq('id', eventId)
  if (error) throw error
}

/**
 * 기록 삭제 — DB row는 cascade로 정리되지만 storage 사진 파일은 직접 지워야 한다.
 * 권한(작성자·모임장)은 RLS가 강제. 확정된 정산이 있으면 잠금 트리거가 막는다.
 */
export async function deleteEvent(eventId: string): Promise<void> {
  // 확정된 정산이 있으면 삭제 불가 (지출 잠금과 동일한 원칙 — 먼저 정산 취소)
  const { data: closed } = await supabase
    .from('settlements')
    .select('id')
    .eq('event_id', eventId)
    .eq('status', 'closed')
    .maybeSingle()
  if (closed) throw new Error('SETTLEMENT_CLOSED')

  const { data: photoRows, error: photoError } = await supabase
    .from('photos')
    .select('storage_path, thumb_path')
    .eq('event_id', eventId)
  if (photoError) throw photoError

  const { error } = await supabase.from('events').delete().eq('id', eventId)
  if (error) throw error

  if (photoRows.length > 0) {
    await supabase.storage
      .from('photos')
      .remove(photoRows.flatMap((p) => [p.storage_path, p.thumb_path]))
  }
}

export async function createEvent(input: {
  groupId: string
  title: string
  type: EventType
  startsAt: string
  endsAt: string | null
  participantIds: string[]
}): Promise<string> {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) throw new Error('로그인이 필요합니다.')

  const { data: event, error } = await supabase
    .from('events')
    .insert({
      group_id: input.groupId,
      title: input.title,
      type: input.type,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      created_by: auth.user.id,
    })
    .select('id')
    .single()
  if (error) throw error

  const { error: pError } = await supabase
    .from('event_participants')
    .insert(input.participantIds.map((user_id) => ({ event_id: event.id, user_id })))
  if (pError) throw pError
  return event.id
}
