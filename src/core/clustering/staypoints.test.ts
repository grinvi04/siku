import { describe, expect, it } from 'vitest'
import type { PhotoPoint } from '@/core/types'
import { distanceM } from './geo'
import { assignPhotoToStayPoint, detectStayPoints } from './staypoints'

const MIN = 60 * 1000
// 위도 1도 ≈ 111km → 0.001도 ≈ 111m. 서울 시청 부근 기준.
const BASE = { lat: 37.5663, lng: 126.9779 }
const photo = (id: string, minute: number, dLat = 0, dLng = 0): PhotoPoint => ({
  id,
  takenAt: minute * MIN,
  lat: BASE.lat + dLat,
  lng: BASE.lng + dLng,
})

describe('distanceM', () => {
  it('위도 0.001도 차이는 약 111m', () => {
    const d = distanceM(BASE.lat, BASE.lng, BASE.lat + 0.001, BASE.lng)
    expect(d).toBeGreaterThan(105)
    expect(d).toBeLessThan(120)
  })
})

describe('detectStayPoints', () => {
  it('같은 장소에서 30분 이상 간격의 사진들 → 방문 1개', () => {
    const result = detectStayPoints([photo('p1', 0), photo('p2', 20, 0.0003), photo('p3', 40)])
    expect(result).toHaveLength(1)
    expect(result[0].photoIds).toEqual(['p1', 'p2', 'p3'])
    expect(result[0].endedAt - result[0].startedAt).toBe(40 * MIN)
  })

  it('체류 30분 미만인 클러스터는 버린다 (이동 중 사진)', () => {
    // 자전거로 이동하며 10분 간격, 각각 다른 위치(>150m)
    const result = detectStayPoints([
      photo('p1', 0),
      photo('p2', 10, 0.005),
      photo('p3', 20, 0.01),
      photo('p4', 30, 0.015),
    ])
    expect(result).toHaveLength(0)
  })

  it('식당(40분) → 이동 → 카페(50분) → 두 방문으로 분리', () => {
    const result = detectStayPoints([
      photo('r1', 0),
      photo('r2', 40),
      photo('move', 50, 0.005), // 이동 중 1장
      photo('c1', 60, 0.01),
      photo('c2', 110, 0.01),
    ])
    expect(result).toHaveLength(2)
    expect(result[0].photoIds).toEqual(['r1', 'r2'])
    expect(result[1].photoIds).toEqual(['c1', 'c2'])
  })

  it('같은 장소 재방문은 별도 방문으로 기록된다', () => {
    const result = detectStayPoints([
      photo('a1', 0),
      photo('a2', 35),
      photo('b1', 60, 0.01), // 다른 곳에서 40분
      photo('b2', 100, 0.01),
      photo('a3', 120), // 처음 장소로 복귀
      photo('a4', 155),
    ])
    expect(result).toHaveLength(3)
    expect(result[2].photoIds).toEqual(['a3', 'a4'])
  })

  it('입력 순서와 무관하게 촬영시각순으로 처리한다 (결정적)', () => {
    const photos = [photo('p3', 40), photo('p1', 0), photo('p2', 20)]
    expect(detectStayPoints(photos)).toEqual(
      detectStayPoints([...photos].reverse()),
    )
  })

  it('사진 1장뿐인 장소는 체류시간 0 → 방문으로 잡지 않는다 (알려진 한계)', () => {
    expect(detectStayPoints([photo('p1', 0)])).toHaveLength(0)
  })
})

describe('assignPhotoToStayPoint', () => {
  const visits = [
    { lat: BASE.lat, lng: BASE.lng, startedAt: 0, endedAt: 60 * MIN, radiusM: 150 },
    { lat: BASE.lat + 0.01, lng: BASE.lng, startedAt: 90 * MIN, endedAt: 150 * MIN, radiusM: 150 },
  ]

  it('시간 구간 + 반경 안이면 해당 방문 인덱스', () => {
    expect(assignPhotoToStayPoint(photo('p', 30), visits)).toBe(0)
    expect(assignPhotoToStayPoint(photo('p', 100, 0.01), visits)).toBe(1)
  })

  it('도착 직전 사진은 허용 오차(10분)로 배정된다', () => {
    expect(assignPhotoToStayPoint(photo('p', 85, 0.01), visits)).toBe(1)
  })

  it('시간은 맞지만 위치가 멀면 null', () => {
    expect(assignPhotoToStayPoint(photo('p', 30, 0.05), visits)).toBeNull()
  })

  it('어느 구간에도 없으면 null (수동 배정 대상)', () => {
    expect(assignPhotoToStayPoint(photo('p', 75), visits)).toBeNull()
  })
})
