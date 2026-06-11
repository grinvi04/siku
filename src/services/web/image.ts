/** 캔버스 기반 이미지 처리 (웹 구현 — Capacitor 전환 시 네이티브 구현으로 교체 가능) */

/** 브라우저가 못 읽는 포맷(아이폰 HEIC 등)은 JPEG로 변환 후 디코딩 */
async function decodeBitmap(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file)
  } catch {
    // heic2any는 무거워서 필요할 때만 로드
    const { default: heic2any } = await import('heic2any')
    const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 })
    return createImageBitmap(Array.isArray(converted) ? converted[0] : converted)
  }
}

export async function resizeImage(
  file: File,
  maxDimension: number,
  quality = 0.85,
  mimeType = 'image/jpeg',
): Promise<Blob> {
  const bitmap = await decodeBitmap(file)
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('이미지 변환에 실패했습니다.'))),
      mimeType,
      quality,
    )
  })
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      resolve(dataUrl.slice(dataUrl.indexOf(',') + 1))
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}
