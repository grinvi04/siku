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

/** 첫 로그인 시 카카오 메타데이터(닉네임·프로필 사진)로 프로필 생성 */
export async function ensureProfile(): Promise<Profile> {
  const existing = await getMyProfile()
  if (existing) return existing

  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) throw new Error('로그인이 필요합니다.')
  const meta = auth.user.user_metadata
  const profile = {
    id: auth.user.id,
    display_name: (meta.name ?? meta.preferred_username ?? '이름없음') as string,
    avatar_url: (meta.avatar_url ?? meta.picture ?? null) as string | null,
  }
  const { data, error } = await supabase.from('profiles').insert(profile).select().single()
  if (error) throw error
  return data
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
