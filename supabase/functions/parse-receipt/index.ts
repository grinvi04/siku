// 영수증 이미지 → Google Cloud Vision OCR → 텍스트 반환
// 시크릿: GOOGLE_VISION_API_KEY (supabase secrets set)
// 인증: verify_jwt 기본값(true) — 로그인한 사용자만 호출 가능
// 남용 방어: 사용자당 일일 호출 제한 (Vision은 결제 연결 API)

import { createClient } from 'npm:@supabase/supabase-js@2'

const DAILY_LIMIT = 30

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/** 게이트웨이가 이미 JWT를 검증했으므로 payload에서 사용자 id만 꺼낸다 */
function userIdFromJwt(req: Request): string | null {
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.replace(/^Bearer\s+/i, '')
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return typeof payload.sub === 'string' ? payload.sub : null
  } catch {
    return null
  }
}

async function checkRateLimit(userId: string): Promise<boolean> {
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )
  const day = new Date().toISOString().slice(0, 10)
  const { data, error } = await admin
    .from('ocr_usage')
    .upsert(
      { user_id: userId, day, count: 1 },
      { onConflict: 'user_id,day', ignoreDuplicates: true },
    )
    .select('count')
    .maybeSingle()
  if (error) throw error
  if (data) return true // 오늘 첫 호출
  // 이미 행이 있으면 증가 후 한도 검사
  const { data: row, error: incError } = await admin.rpc('increment_ocr_usage', {
    p_user_id: userId,
    p_day: day,
  })
  if (incError) throw incError
  return (row as number) <= DAILY_LIMIT
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const userId = userIdFromJwt(req)
    if (!userId) return json({ error: '인증이 필요합니다.' }, 401)
    if (!(await checkRateLimit(userId))) {
      return json({ error: '오늘 영수증 인식 한도를 다 썼어요. 내일 다시 시도해 주세요.' }, 429)
    }

    const { image } = await req.json()
    if (typeof image !== 'string' || image.length === 0) {
      return json({ error: '이미지가 없습니다.' }, 400)
    }
    // base64 4/3 배수 고려 ~6MB 원본 제한
    if (image.length > 8_000_000) {
      return json({ error: '이미지가 너무 큽니다.' }, 413)
    }

    const apiKey = Deno.env.get('GOOGLE_VISION_API_KEY')
    if (!apiKey) return json({ error: 'OCR 설정이 되어 있지 않습니다.' }, 500)

    const visionRes = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [
            {
              image: { content: image },
              features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
              imageContext: { languageHints: ['ko'] },
            },
          ],
        }),
      },
    )
    if (!visionRes.ok) {
      console.error('vision error', visionRes.status, await visionRes.text())
      return json({ error: 'OCR 호출에 실패했습니다.' }, 502)
    }
    const data = await visionRes.json()
    const text: string = data.responses?.[0]?.fullTextAnnotation?.text ?? ''
    return json({ text })
  } catch (e) {
    console.error(e)
    return json({ error: '처리 중 오류가 발생했습니다.' }, 500)
  }
})

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}
