import type { PhotoPoint, StayPoint } from '../types'
import { distanceM } from './geo'

export interface StayPointOptions {
  /** 클러스터 반경 (미터) */
  radiusM?: number
  /** 최소 체류 시간 (밀리초) */
  minStayMs?: number
}

const DEFAULT_RADIUS_M = 150
const DEFAULT_MIN_STAY_MS = 30 * 60 * 1000

/**
 * 사진의 GPS·촬영시각으로 "방문 장소"를 사후 재구성한다 (stay-point detection, greedy).
 *
 * - 촬영시각순으로 훑으며 현재 클러스터 중심에서 radiusM 이내인 사진을 편입(중심은 평균으로 갱신)
 * - 반경을 벗어나면 클러스터를 종료하고, 체류시간(첫~마지막 사진)이 minStayMs 이상일 때만
 *   방문으로 채택 — 자전거 이동 중 찍은 사진은 자동 배제된다
 * - 좌표나 시각이 없는 사진은 입력에서 제외하고 호출할 것
 */
export function detectStayPoints(photos: PhotoPoint[], options: StayPointOptions = {}): StayPoint[] {
  const radiusM = options.radiusM ?? DEFAULT_RADIUS_M
  const minStayMs = options.minStayMs ?? DEFAULT_MIN_STAY_MS
  const sorted = [...photos].sort((a, b) => a.takenAt - b.takenAt || (a.id < b.id ? -1 : 1))

  const stayPoints: StayPoint[] = []
  let cluster: PhotoPoint[] = []
  let centerLat = 0
  let centerLng = 0

  const flush = () => {
    if (cluster.length === 0) return
    const duration = cluster[cluster.length - 1].takenAt - cluster[0].takenAt
    if (duration >= minStayMs) {
      stayPoints.push({
        lat: centerLat,
        lng: centerLng,
        startedAt: cluster[0].takenAt,
        endedAt: cluster[cluster.length - 1].takenAt,
        photoIds: cluster.map((p) => p.id),
      })
    }
    cluster = []
  }

  for (const photo of sorted) {
    if (cluster.length === 0 || distanceM(centerLat, centerLng, photo.lat, photo.lng) <= radiusM) {
      cluster.push(photo)
      centerLat = cluster.reduce((s, p) => s + p.lat, 0) / cluster.length
      centerLng = cluster.reduce((s, p) => s + p.lng, 0) / cluster.length
    } else {
      flush()
      cluster = [photo]
      centerLat = photo.lat
      centerLng = photo.lng
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
