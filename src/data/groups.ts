import { supabase } from './supabase'
import type { Profile } from './profiles'

export interface GroupSummary {
  id: string
  name: string
  member_count: number
}

export interface GroupDetail {
  id: string
  name: string
  invite_code: string
  members: { user_id: string; role: string; profile: Pick<Profile, 'display_name' | 'avatar_url'> }[]
}

export async function listMyGroups(): Promise<GroupSummary[]> {
  const { data, error } = await supabase
    .from('groups')
    .select('id, name, group_members(count)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data.map((g) => ({
    id: g.id,
    name: g.name,
    member_count: (g.group_members as unknown as { count: number }[])[0]?.count ?? 0,
  }))
}

export async function getGroup(groupId: string): Promise<GroupDetail> {
  const { data, error } = await supabase
    .from('groups')
    .select('id, name, invite_code, group_members(user_id, role, profile:profiles(display_name, avatar_url))')
    .eq('id', groupId)
    .single()
  if (error) throw error
  return {
    id: data.id,
    name: data.name,
    invite_code: data.invite_code,
    members: data.group_members as unknown as GroupDetail['members'],
  }
}

export async function createGroup(name: string): Promise<string> {
  const { data, error } = await supabase.rpc('create_group', { p_name: name })
  if (error) throw error
  return data as string
}

export interface InvitePreview {
  group_id: string
  name: string
  member_count: number
}

export async function getInvitePreview(inviteCode: string): Promise<InvitePreview | null> {
  const { data, error } = await supabase.rpc('get_invite_preview', { p_invite_code: inviteCode })
  if (error) throw error
  return (data as InvitePreview[])[0] ?? null
}

export async function joinGroup(inviteCode: string): Promise<string> {
  const { data, error } = await supabase.rpc('join_group', { p_invite_code: inviteCode })
  if (error) throw error
  return data as string
}
