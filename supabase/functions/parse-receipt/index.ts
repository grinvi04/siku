// 영수증 이미지 → Google Cloud Vision OCR → 텍스트 반환
// 시크릿: GOOGLE_VISION_API_KEY (supabase secrets set)
// 인증: verify_jwt 기본값(true) — 로그인한 사용자만 호출 가능

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
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
