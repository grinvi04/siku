// 좌표 → 주변 장소 이름 후보 (카카오 로컬 API)
// 시크릿: KAKAO_REST_API_KEY / 인증: verify_jwt 기본값(true)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 모임에서 갈 만한 곳: 음식점, 카페, 관광명소, 문화시설, 숙박
const CATEGORY_GROUPS = ['FD6', 'CE7', 'AT4', 'CT1', 'AD5']

interface KakaoPlace {
  place_name: string
  category_group_name: string
  distance: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { lat, lng } = await req.json()
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return json({ error: '좌표가 없습니다.' }, 400)
    }

    const kakaoKey = Deno.env.get('KAKAO_REST_API_KEY')
    const googleKey = Deno.env.get('GOOGLE_PLACES_API_KEY')

    if (kakaoKey) {
      const results = await Promise.all(
        CATEGORY_GROUPS.map(async (code) => {
          const url =
            `https://dapi.kakao.com/v2/local/search/category.json` +
            `?category_group_code=${code}&x=${lng}&y=${lat}&radius=200&size=3&sort=distance`
          const res = await fetch(url, { headers: { Authorization: `KakaoAK ${kakaoKey}` } })
          if (!res.ok) return []
          const data = await res.json()
          return (data.documents ?? []) as KakaoPlace[]
        }),
      )
      const places = results
        .flat()
        .map((p) => ({
          name: p.place_name,
          category: p.category_group_name,
          distance: parseInt(p.distance, 10),
        }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 4)
      return json({ places })
    }

    if (googleKey) {
      // Google Places API (New) — Nearby Search
      const res = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': googleKey,
          'X-Goog-FieldMask': 'places.displayName,places.primaryTypeDisplayName',
        },
        body: JSON.stringify({
          locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius: 200 } },
          maxResultCount: 4,
          rankPreference: 'DISTANCE',
          languageCode: 'ko',
        }),
      })
      if (!res.ok) {
        console.error('places error', res.status, await res.text())
        return json({ places: [] })
      }
      const data = await res.json()
      const places = ((data.places ?? []) as {
        displayName?: { text?: string }
        primaryTypeDisplayName?: { text?: string }
      }[])
        .map((p) => ({
          name: p.displayName?.text ?? '',
          category: p.primaryTypeDisplayName?.text ?? '',
          distance: 0,
        }))
        .filter((p) => p.name)
      return json({ places })
    }

    return json({ places: [] }) // 키 미설정 시 조용히 빈 결과
  } catch (e) {
    console.error(e)
    return json({ error: '주변 장소를 찾지 못했습니다.' }, 500)
  }
})

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}
