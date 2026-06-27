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

  it('이동 중 사진은 각각 1장짜리 후보가 된다 (사용자가 거절로 정리)', () => {
    // 자전거로 이동하며 10분 간격, 각각 다른 위치(>150m)
    const result = detectStayPoints([
      photo('p1', 0),
      photo('p2', 10, 0.005),
      photo('p3', 20, 0.01),
      photo('p4', 30, 0.015),
    ])
    expect(result).toHaveLength(4)
    expect(result.every((s) => s.photoIds.length === 1)).toBe(true)
  })

  it('minPhotos 옵션으로 1장짜리 후보를 걸러낼 수 있다', () => {
    const result = detectStayPoints(
      [photo('p1', 0), photo('p2', 10, 0.005), photo('a1', 30, 0.01), photo('a2', 35, 0.01)],
      { minPhotos: 2 },
    )
    expect(result).toHaveLength(1)
    expect(result[0].photoIds).toEqual(['a1', 'a2'])
  })

  it('식당 → 이동(1장) → 카페 → 세 후보로 분리, 위치별 사진이 올바르게 묶인다', () => {
    const result = detectStayPoints([
      photo('r1', 0),
      photo('r2', 40),
      photo('move', 50, 0.005), // 이동 중 1장 — 1장짜리 후보
      photo('c1', 60, 0.01),
      photo('c2', 110, 0.01),
    ])
    expect(result.map((s) => s.photoIds)).toEqual([['r1', 'r2'], ['move'], ['c1', 'c2']])
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
    expect(detectStayPoints(photos)).toEqual(detectStayPoints([...photos].reverse()))
  })

  it('사진 1장뿐인 장소도 방문 후보가 된다', () => {
    expect(detectStayPoints([photo('p1', 0)])).toHaveLength(1)
  })
})

describe('detectStayPoints — 경계·옵션', () => {
  it('빈 입력 → 빈 결과', () => {
    expect(detectStayPoints([])).toEqual([])
  })

  it('같은 자리에서 연달아 찍힌 2장(1분 간격)도 방문 후보다', () => {
    expect(detectStayPoints([photo('p1', 0), photo('p2', 1)])).toHaveLength(1)
  })

  it('반경 안(~149m)은 같은 클러스터, 밖(~155m)은 분리', () => {
    // 위도 0.00134° ≈ 149m, 0.0014° ≈ 156m
    const inside = detectStayPoints([photo('p1', 0), photo('p2', 35, 0.00134)])
    expect(inside).toHaveLength(1)
    const outside = detectStayPoints([
      photo('p1', 0),
      photo('p2', 35, 0.0014),
      photo('p3', 70, 0.0014),
    ])
    expect(outside.map((s) => s.photoIds)).toEqual([['p1'], ['p2', 'p3']])
  })

  it('minStayMs 옵션으로 시간 기준을 강화할 수 있다 (네이티브 자동 스캔 대비)', () => {
    const photos = [photo('p1', 0), photo('p2', 15)]
    expect(detectStayPoints(photos)).toHaveLength(1) // 기본: 2장이면 후보
    expect(detectStayPoints(photos, { minStayMs: 20 * MIN })).toHaveLength(0)
  })

  it('같은 시각 연사 여러 장도 방문 후보다 (그 자리에 있었다는 증거)', () => {
    expect(detectStayPoints([photo('p1', 5), photo('p2', 5), photo('p3', 5)])).toHaveLength(1)
  })

  it('점진 이동(드리프트)은 앵커 기준으로 분리 — 동네 전체가 한 방문이 되지 않는다', () => {
    // 10분마다 ~55m씩 이동: 앵커에서 165m 벗어나는 4번째 사진에서 분리
    const drift = [0, 1, 2, 3].map((i) => photo(`p${i}`, i * 10, i * 0.0005))
    const result = detectStayPoints(drift)
    expect(result.map((s) => s.photoIds)).toEqual([['p0', 'p1', 'p2'], ['p3']])
  })

  it('같은 자리여도 시간 간격이 크면(6시간 초과) 별도 방문', () => {
    const result = detectStayPoints([
      photo('m1', 0),
      photo('m2', 40),
      photo('e1', 460), // 7시간 뒤 같은 자리
      photo('e2', 500),
    ])
    expect(result).toHaveLength(2)
    expect(result[0].photoIds).toEqual(['m1', 'm2'])
    expect(result[1].photoIds).toEqual(['e1', 'e2'])
  })

  it('maxGapMs 옵션으로 간격 기준을 조정할 수 있다', () => {
    const photos = [photo('p1', 0), photo('p2', 40)]
    expect(detectStayPoints(photos, { maxGapMs: 30 * MIN })).toHaveLength(2) // 분리 → 1장짜리 둘
    expect(detectStayPoints(photos, { maxGapMs: 60 * MIN })).toHaveLength(1)
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

  it('허용 오차 경계 정확히 10분 전은 배정, 그보다 1초 전은 미배정', () => {
    expect(assignPhotoToStayPoint(photo('p', 80, 0.01), visits)).toBe(1)
    const justBefore = { ...photo('p', 80, 0.01), takenAt: 80 * MIN - 1000 }
    expect(assignPhotoToStayPoint(justBefore, visits)).toBeNull()
  })

  it('시간 구간이 겹치는 두 방문이면 앞선 방문을 선택한다', () => {
    const overlapping = [
      { lat: BASE.lat, lng: BASE.lng, startedAt: 0, endedAt: 60 * MIN, radiusM: 150 },
      { lat: BASE.lat, lng: BASE.lng, startedAt: 30 * MIN, endedAt: 90 * MIN, radiusM: 150 },
    ]
    expect(assignPhotoToStayPoint(photo('p', 40), overlapping)).toBe(0)
  })

  it('시간은 맞지만 위치가 멀면 null', () => {
    expect(assignPhotoToStayPoint(photo('p', 30, 0.05), visits)).toBeNull()
  })

  it('어느 구간에도 없으면 null (수동 배정 대상)', () => {
    expect(assignPhotoToStayPoint(photo('p', 75), visits)).toBeNull()
  })
})
