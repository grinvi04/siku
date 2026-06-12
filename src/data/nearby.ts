import { supabase } from './supabase'

export interface NearbyPlace {
  name: string
  category: string
  distance: number
}

/** 좌표 주변 장소 이름 후보 (카카오 로컬 — 미설정/실패 시 빈 배열) */
export async function fetchNearbyPlaces(lat: number, lng: number): Promise<NearbyPlace[]> {
  try {
    const { data, error } = await supabase.functions.invoke('nearby-places', {
      body: { lat, lng },
    })
    if (error) return []
    return (data as { places?: NearbyPlace[] }).places ?? []
  } catch {
    return []
  }
}
