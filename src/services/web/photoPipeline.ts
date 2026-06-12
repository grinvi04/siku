import exifr from 'exifr'
import { resizeImage, type ResizedImage } from './image'

/** 업로드 전 사진 1장의 가공 결과 — EXIF는 리사이즈 전에 추출해야 한다 (캔버스가 메타데이터를 제거) */
export interface ProcessedPhoto {
  main: ResizedImage
  thumb: ResizedImage
  /** ISO 문자열, EXIF 없으면 null (스크린샷·카톡 저장본 등) */
  takenAt: string | null
  lat: number | null
  lng: number | null
}

/**
 * EXIF 추출 → 본문(장변 1600px)·썸네일(320px) WebP 생성.
 * 원본은 보관하지 않고, 저장본에는 위치 정보가 남지 않는다.
 */
export async function processPhoto(file: File): Promise<ProcessedPhoto> {
  const [gps, tags] = await Promise.all([
    exifr.gps(file).catch(() => null),
    exifr
      .parse(file, ['DateTimeOriginal', 'CreateDate'])
      .catch(() => null as Record<string, unknown> | null),
  ])

  const takenDate = (tags?.DateTimeOriginal ?? tags?.CreateDate) as Date | undefined
  const [main, thumb] = await Promise.all([
    resizeImage(file, 1600, 0.8, 'image/webp'),
    resizeImage(file, 320, 0.7, 'image/webp'),
  ])

  return {
    main,
    thumb,
    takenAt: takenDate instanceof Date && !isNaN(takenDate.getTime()) ? takenDate.toISOString() : null,
    lat: gps?.latitude ?? null,
    lng: gps?.longitude ?? null,
  }
}
