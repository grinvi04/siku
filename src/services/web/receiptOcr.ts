import { parseReceiptText, type ParsedReceipt } from '@/core/receipt/parse'
import { supabase } from '@/data/supabase'
import { blobToBase64, resizeImage } from './image'

/**
 * 영수증 사진 → Edge Function(Google Vision OCR) → 텍스트 파싱.
 * GCP 키는 서버(Edge Function 시크릿)에만 있고 클라이언트로 노출되지 않는다.
 */
export async function recognizeReceipt(file: File): Promise<ParsedReceipt> {
  // OCR 정확도와 전송량의 균형 — 장변 1600px JPEG
  const { blob } = await resizeImage(file, 1600)
  const image = await blobToBase64(blob)

  const { data, error } = await supabase.functions.invoke('parse-receipt', {
    body: { image },
  })
  if (error) throw error
  return parseReceiptText((data as { text: string }).text ?? '')
}
