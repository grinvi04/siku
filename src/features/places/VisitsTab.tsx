import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { useToast } from '@/components/Toast'
import { distanceM } from '@/core/clustering'
import { detectStayPoints } from '@/core/clustering'
import type { PhotoPoint, StayPoint } from '@/core/types'
import type { EventDetail } from '@/data/events'
import { listPhotos } from '@/data/photos'
import {
  addManualVisit,
  confirmVisit,
  deleteVisit,
  listVisits,
  rejectVisit,
  replaceSuggestedVisits,
  type VisitRow,
} from '@/data/visits'
import { fetchNearbyPlaces } from '@/data/nearby'
import { formatDate, formatTimeRange } from '@/lib/format'
import { MapPin } from 'lucide-react'

/** 자동 인식된 좌표 주변 장소 이름 후보 — 탭하면 이름이 채워진다 */
function NearbyNameChips({ visit, onPick }: { visit: VisitRow; onPick: (name: string) => void }) {
  const { data: places } = useQuery({
    queryKey: ['nearby', visit.id],
    queryFn: () => fetchNearbyPlaces(visit.lat!, visit.lng!),
    enabled: visit.lat != null && visit.lng != null,
    staleTime: Infinity,
  })
  if (!places || places.length === 0) return null
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {places.map((p) => (
        <button
          key={p.name}
          type="button"
          className="flex min-h-11 items-center rounded-full bg-white px-3.5 text-sm text-ink"
          onClick={() => onPick(p.name)}
        >
          {p.name}
          {p.distance > 0 && <span className="text-ink-soft">&nbsp;{p.distance}m</span>}
        </button>
      ))}
    </div>
  )
}

const TOLERANCE_MS = 10 * 60 * 1000

/** 좌표 있는 확정 방문과 시간·거리가 겹치는 제안은 다시 만들지 않는다 (거절 기록은 재스캔 시 리셋) */
function overlapsExisting(sp: StayPoint, visits: VisitRow[]): boolean {
  return visits.some((v) => {
    if (v.lat == null || v.lng == null) return false
    if (v.status !== 'confirmed') return false
    const start = new Date(v.started_at).getTime()
    const end = new Date(v.ended_at).getTime()
    const timeOverlap = sp.startedAt <= end + TOLERANCE_MS && sp.endedAt >= start - TOLERANCE_MS
    return timeOverlap && distanceM(v.lat, v.lng, sp.lat, sp.lng) <= v.radius_m + 150
  })
}

export function VisitsTab({ event }: { event: EventDetail }) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [nameDrafts, setNameDrafts] = useState<Record<string, string>>({})
  const [manualName, setManualName] = useState('')

  const { data: visits } = useQuery({
    queryKey: ['visits', event.id],
    queryFn: () => listVisits(event.id),
  })
  const { data: photos } = useQuery({
    queryKey: ['photos', event.id],
    queryFn: () => listPhotos(event.id),
  })

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['visits', event.id] })

  const gpsPhotos = (photos ?? []).filter(
    (p) => p.lat != null && p.lng != null && p.taken_at != null,
  )

  const suggest = useMutation({
    mutationFn: async () => {
      const points: PhotoPoint[] = gpsPhotos.map((p) => ({
        id: p.id,
        lat: p.lat!,
        lng: p.lng!,
        takenAt: new Date(p.taken_at!).getTime(),
      }))
      const stayPoints = detectStayPoints(points).filter(
        (sp) => !overlapsExisting(sp, visits ?? []),
      )
      return replaceSuggestedVisits(event.id, stayPoints)
    },
    onSuccess: (count) => {
      invalidate()
      if (count > 0) {
        toast(`머문 장소 ${count}곳을 찾았어요. 이름을 붙여 주세요`)
      } else if (gpsPhotos.length < 2) {
        toast('위치 정보가 있는 사진이 2장 이상 있어야 찾을 수 있어요')
      } else {
        toast('같은 곳에서 찍힌 사진이 2장 이상인 곳이 없어요. 사진을 더 올려 보세요')
      }
    },
    onError: () => toast('장소를 찾지 못했어요. 다시 시도해 주세요'),
  })

  const confirm = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => confirmVisit(id, name),
    onSuccess: () => {
      invalidate()
      toast('다녀온 곳에 추가했어요')
    },
    onError: () => toast('처리하지 못했어요. 다시 시도해 주세요'),
  })
  const reject = useMutation({
    mutationFn: rejectVisit,
    onSuccess: invalidate,
    onError: () => toast('처리하지 못했어요. 다시 시도해 주세요'),
  })
  const remove = useMutation({
    mutationFn: deleteVisit,
    onSuccess: () => {
      invalidate()
      toast('장소를 지웠어요')
    },
    onError: () => toast('지우지 못했어요. 다시 시도해 주세요'),
  })
  const addManual = useMutation({
    mutationFn: (name: string) =>
      addManualVisit({
        eventId: event.id,
        name,
        startedAt: event.starts_at,
        endedAt: event.ends_at ?? event.starts_at,
      }),
    onSuccess: () => {
      invalidate()
      setManualName('')
      toast('장소를 추가했어요')
    },
    onError: () => toast('추가하지 못했어요. 다시 시도해 주세요'),
  })

  const photoCountFor = (v: VisitRow) =>
    (photos ?? []).filter((p) => {
      if (!p.taken_at) return false
      const t = new Date(p.taken_at).getTime()
      const inTime =
        t >= new Date(v.started_at).getTime() - TOLERANCE_MS &&
        t <= new Date(v.ended_at).getTime() + TOLERANCE_MS
      if (!inTime) return false
      if (v.lat == null || v.lng == null) return true
      return p.lat != null && distanceM(v.lat, v.lng, p.lat, p.lng!) <= v.radius_m + 50
    }).length

  const visible = (visits ?? []).filter((v) => v.status !== 'rejected')
  const suggested = visible.filter((v) => v.status === 'suggested')
  const confirmed = visible.filter((v) => v.status === 'confirmed')

  return (
    <div className="mt-6">
      <Button
        variant="secondary"
        disabled={suggest.isPending || gpsPhotos.length === 0}
        onClick={() => suggest.mutate()}
      >
        {suggest.isPending ? '사진을 살펴보고 있어요…' : '사진으로 다녀온 곳 찾기'}
      </Button>
      <p className="mt-1.5 text-sm text-ink-soft">
        {gpsPhotos.length > 0
          ? `위치 정보가 있는 사진 ${gpsPhotos.length}장으로 어디서 머물렀는지 찾아드려요.`
          : '위치 정보가 있는 사진을 올리면 자동으로 찾아드려요.'}
      </p>

      {/* 자동 인식 제안 — 승인 대기 */}
      {suggested.length > 0 && (
        <section className="mt-6 space-y-3">
          <h2 className="text-[19px] font-semibold">여기 머물렀나요?</h2>
          {suggested.map((visit) => (
            <div key={visit.id} className="rounded-2xl bg-accent-container p-4">
              <p className="text-sm text-ink-soft">
                {formatDate(visit.started_at)} · {formatTimeRange(visit.started_at, visit.ended_at)}{' '}
                · 사진 {photoCountFor(visit)}장
              </p>
              <div className="mt-3">
                <Input
                  id={`visit-name-${visit.id}`}
                  placeholder="장소 이름 (예: ○○식당, △△해변)"
                  value={nameDrafts[visit.id] ?? ''}
                  onChange={(e) =>
                    setNameDrafts((prev) => ({ ...prev, [visit.id]: e.target.value }))
                  }
                />
                <NearbyNameChips
                  visit={visit}
                  onPick={(name) => setNameDrafts((prev) => ({ ...prev, [visit.id]: name }))}
                />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button
                  variant="text"
                  className="!text-ink-soft"
                  onClick={() => reject.mutate(visit.id)}
                >
                  아니에요
                </Button>
                <Button
                  onClick={() => confirm.mutate({ id: visit.id, name: nameDrafts[visit.id] ?? '' })}
                >
                  맞아요
                </Button>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* 확정된 타임라인 */}
      <section className="mt-8">
        <h2 className="text-[19px] font-semibold">다녀온 곳</h2>
        {confirmed.length > 0 ? (
          <ul className="mt-1">
            {confirmed.map((visit) => (
              <li
                key={visit.id}
                className="flex min-h-14 items-center justify-between border-b border-line py-3"
              >
                <div>
                  <p className="text-base font-semibold">{visit.name ?? '이름 없는 장소'}</p>
                  <p className="mt-0.5 text-sm text-ink-soft">
                    {formatDate(visit.started_at)} ·{' '}
                    {formatTimeRange(visit.started_at, visit.ended_at)}
                    {photoCountFor(visit) > 0 && ` · 사진 ${photoCountFor(visit)}장`}
                  </p>
                </div>
                <button
                  type="button"
                  className="h-11 px-2 text-sm text-ink-soft"
                  onClick={() => remove.mutate(visit.id)}
                >
                  지우기
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-6 text-center">
            <MapPin size={36} className="mx-auto text-ink-faint" />
            <p className="mt-2 text-base text-ink-soft">
              아직 기록된 장소가 없어요. 위 버튼으로 찾거나 아래에서 직접 추가하세요.
            </p>
          </div>
        )}
      </section>

      {/* 수동 추가 */}
      <form
        className="mt-6 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          const name = manualName.trim()
            if (!name) {
              toast('장소 이름을 입력해 주세요')
              return
            }
            addManual.mutate(name)
        }}
      >
        <div className="flex-1">
          <Input
            id="manual-visit-name"
            placeholder="직접 추가 (예: ○○카페)"
            value={manualName}
            onChange={(e) => setManualName(e.target.value)}
          />
        </div>
        <Button type="submit" variant="secondary" className="!w-24 shrink-0" disabled={addManual.isPending}>
          추가
        </Button>
      </form>
    </div>
  )
}
