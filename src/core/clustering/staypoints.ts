import type { PhotoPoint, StayPoint } from '@/core/types'
import { distanceM } from './geo'

export interface StayPointOptions {
  /** 클러스터 반경 (미터) */
  radiusM?: number
  /** 최소 체류 시간 (밀리초) */
  minStayMs?: number
  /** 연속 사진 사이 최대 간격 (밀리초) — 초과하면 같은 자리여도 별도 방문 */
  maxGapMs?: number
}

const DEFAULT_RADIUS_M = 150
// 직접 고른 사진은 한 장소에서 긴 간격으로 찍는 일이 드물어 10분이 현실적.
// 이동 중 오인은 반경 조건이 걸러준다 (10분이면 도보로도 150m를 벗어남).
// 추후 네이티브 자동 스캔에서는 옵션으로 더 엄격하게 줄 것.
const DEFAULT_MIN_STAY_MS = 10 * 60 * 1000
const DEFAULT_MAX_GAP_MS = 2 * 60 * 60 * 1000

/**
 * 사진의 GPS·촬영시각으로 "방문 장소"를 사후 재구성한다 (stay-point detection).
 *
 * - 촬영시각순으로 훑으며 **앵커(클러스터 첫 사진)** 기준 radiusM 이내인 사진을 편입
 *   (중심 평균을 따라가면 점진 이동으로 동네 전체가 한 방문이 되는 문제가 있어 앵커 고정)
 * - 연속 사진 간격이 maxGapMs를 넘으면 같은 자리여도 방문을 분리
 *   (아침의 집과 저녁의 집은 다른 방문 — 하루가 한 덩어리로 뭉치는 것 방지)
 * - 체류시간(첫~마지막 사진)이 minStayMs 이상일 때만 방문으로 채택
 *   — 자전거 이동 중 찍은 사진은 자동 배제된다
 * - 좌표나 시각이 없는 사진은 입력에서 제외하고 호출할 것
 */
export function detectStayPoints(photos: PhotoPoint[], options: StayPointOptions = {}): StayPoint[] {
  const radiusM = options.radiusM ?? DEFAULT_RADIUS_M
  const minStayMs = options.minStayMs ?? DEFAULT_MIN_STAY_MS
  const maxGapMs = options.maxGapMs ?? DEFAULT_MAX_GAP_MS
  const sorted = [...photos].sort((a, b) => a.takenAt - b.takenAt || (a.id < b.id ? -1 : 1))

  const stayPoints: StayPoint[] = []
  let cluster: PhotoPoint[] = []

  const flush = () => {
    if (cluster.length === 0) return
    const duration = cluster[cluster.length - 1].takenAt - cluster[0].takenAt
    if (duration >= minStayMs) {
      stayPoints.push({
        lat: cluster.reduce((s, p) => s + p.lat, 0) / cluster.length,
        lng: cluster.reduce((s, p) => s + p.lng, 0) / cluster.length,
        startedAt: cluster[0].takenAt,
        endedAt: cluster[cluster.length - 1].takenAt,
        photoIds: cluster.map((p) => p.id),
      })
    }
    cluster = []
  }

  for (const photo of sorted) {
    const anchor = cluster[0]
    const last = cluster[cluster.length - 1]
    const sameVisit =
      anchor !== undefined &&
      photo.takenAt - last.takenAt <= maxGapMs &&
      distanceM(anchor.lat, anchor.lng, photo.lat, photo.lng) <= radiusM
    if (cluster.length === 0 || sameVisit) {
      cluster.push(photo)
    } else {
      flush()
      cluster = [photo]
    }
  }
  flush()
  return stayPoints
}

/**
 * 사진을 기존 방문(visit)에 배정한다 — 시간 구간 안이면서 반경 이내인 첫 방문.
 * 어디에도 안 맞으면 null (수동 배정 대상).
 */
export function assignPhotoToStayPoint(
  photo: PhotoPoint,
  stayPoints: { lat: number; lng: number; startedAt: number; endedAt: number; radiusM: number }[],
  /** 구간 경계 허용 오차 (기본 10분 — 도착 직전/직후 사진) */
  toleranceMs = 10 * 60 * 1000,
): number | null {
  for (let i = 0; i < stayPoints.length; i++) {
    const v = stayPoints[i]
    if (
      photo.takenAt >= v.startedAt - toleranceMs &&
      photo.takenAt <= v.endedAt + toleranceMs &&
      distanceM(v.lat, v.lng, photo.lat, photo.lng) <= v.radiusM
    ) {
      return i
    }
  }
  return null
}
