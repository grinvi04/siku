import { supabase } from './supabase'

export type EventType = 'dinner' | 'ride' | 'trip'

export const EVENT_TYPE_LABEL: Record<EventType, string> = {
  dinner: '저녁모임',
  ride: '라이딩',
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
      'id, group_id, title, type, starts_at, ends_at, event_participants(user_id, profile:profiles(display_name, avatar_url))',
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
    participants,
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
