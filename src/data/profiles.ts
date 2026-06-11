import { supabase } from './supabase'

export interface Profile {
  id: string
  display_name: string
  avatar_url: string | null
  bank_name: string | null
  account_number: string | null
  account_holder: string | null
}

export async function getMyProfile(): Promise<Profile | null> {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return null
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', auth.user.id)
    .maybeSingle()
  if (error) throw error
  return data
}

/** 첫 로그인 시 프로필 생성 — 이름 기본값은 이메일 앞부분, 내 정보에서 수정 */
export async function ensureProfile(): Promise<{ profile: Profile; created: boolean }> {
  const existing = await getMyProfile()
  if (existing) return { profile: existing, created: false }

  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) throw new Error('로그인이 필요합니다.')
  const profile = {
    id: auth.user.id,
    display_name: auth.user.email?.split('@')[0] ?? '이름없음',
    avatar_url: null,
  }
  const { data, error } = await supabase.from('profiles').insert(profile).select().single()
  if (error) throw error
  return { profile: data, created: true }
}

export async function updateMyProfile(
  patch: Partial<Omit<Profile, 'id'>>,
): Promise<Profile> {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) throw new Error('로그인이 필요합니다.')
  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', auth.user.id)
    .select()
    .single()
  if (error) throw error
  return data
}
