import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { Button } from '@/components/Button'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useToast } from '@/components/Toast'
import type { EventDetail } from '@/data/events'
import {
  deletePhotos,
  getPhotoUrl,
  listPhotos,
  uploadPhotos,
  type PhotoWithUrl,
} from '@/data/photos'
import { formatDate } from '@/lib/format'
import { Images } from 'lucide-react'
import { useSession } from '@/features/auth/useSession'

export function PhotosTab({ event }: { event: EventDetail }) {
  const { session } = useSession()
  const me = session?.user.id
  const queryClient = useQueryClient()
  const toast = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [viewer, setViewer] = useState<{ photo: PhotoWithUrl; url: string | null } | null>(null)
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmTarget, setConfirmTarget] = useState<PhotoWithUrl[] | null>(null)

  const { data: photos, isLoading } = useQuery({
    queryKey: ['photos', event.id],
    queryFn: () => listPhotos(event.id),
  })

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['photos', event.id] })
  const myPhotoCount = (photos ?? []).filter((p) => p.uploader_id === me).length

  const handleUpload = async (files: File[]) => {
    setProgress({ done: 0, total: files.length })
    try {
      const result = await uploadPhotos(event.group_id, event.id, files, (done, total) =>
        setProgress({ done, total }),
      )
      invalidate()
      if (result.failed === 0) {
        toast(`사진 ${result.uploaded}장을 올렸어요`)
      } else {
        const reason = result.reasons[0] ? ` (${result.reasons[0]})` : ''
        toast(`${result.uploaded}장 성공, ${result.failed}장 실패${reason}`)
      }
    } finally {
      setProgress(null)
    }
  }

  const openViewer = async (photo: PhotoWithUrl) => {
    setViewer({ photo, url: null })
    try {
      setViewer({ photo, url: await getPhotoUrl(photo.storage_path) })
    } catch {
      setViewer({ photo, url: photo.thumbUrl })
    }
  }

  const toggleSelect = (photo: PhotoWithUrl) => {
    if (photo.uploader_id !== me) {
      toast('내가 올린 사진만 지울 수 있어요')
      return
    }
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(photo.id)) next.delete(photo.id)
      else next.add(photo.id)
      return next
    })
  }

  const remove = useMutation({
    mutationFn: deletePhotos,
    onSuccess: (_, deleted) => {
      invalidate()
      setViewer(null)
      setSelecting(false)
      setSelected(new Set())
      toast(deleted.length > 1 ? `사진 ${deleted.length}장을 지웠어요` : '사진을 지웠어요')
    },
    onError: () => toast('지우지 못했어요. 다시 시도해 주세요'),
  })

  return (
    <div className="mt-6 pb-20">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = [...(e.target.files ?? [])]
          e.target.value = ''
          if (files.length > 0) void handleUpload(files)
        }}
      />
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <Button
            variant="secondary"
            disabled={!!progress || selecting}
            onClick={() => fileInputRef.current?.click()}
          >
            {progress ? `올리는 중… ${progress.done}/${progress.total}` : '사진 올리기'}
          </Button>
        </div>
        {myPhotoCount > 0 && (
          <button
            type="button"
            className="h-13 shrink-0 rounded-xl bg-surface px-4 text-base font-semibold text-ink-soft"
            onClick={() => {
              setSelecting((s) => !s)
              setSelected(new Set())
            }}
          >
            {selecting ? '취소' : '선택'}
          </button>
        )}
      </div>
      {selecting && (
        <p className="mt-1.5 text-sm text-ink-soft">지울 사진을 눌러 선택하세요 (내 사진만)</p>
      )}

      {isLoading ? (
        <p className="mt-8 text-center text-ink-soft">불러오는 중…</p>
      ) : photos && photos.length > 0 ? (
        <div className="mt-4 grid grid-cols-3 gap-0.5">
          {photos.map((photo) => {
            const isSelected = selected.has(photo.id)
            const dimmed = selecting && photo.uploader_id !== me
            return (
              <button
                key={photo.id}
                type="button"
                className="relative aspect-square overflow-hidden bg-surface"
                onClick={() => (selecting ? toggleSelect(photo) : void openViewer(photo))}
              >
                <img
                  src={photo.thumbUrl}
                  alt=""
                  loading="lazy"
                  className={`h-full w-full object-cover ${dimmed ? 'opacity-30' : ''}`}
                />
                {isSelected && (
                  <span className="absolute inset-0 flex items-center justify-center bg-primary/40">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-base font-bold text-white">
                      ✓
                    </span>
                  </span>
                )}
              </button>
            )
          })}
        </div>
      ) : (
        <div className="mt-10 text-center">
          <Images size={40} className="mx-auto text-ink-faint" />
          <p className="mt-3 text-base text-ink-soft">
            아직 사진이 없어요. 모임에서 찍은 사진을 올려 보세요.
          </p>
        </div>
      )}

      {/* 선택 모드 하단 고정 삭제 버튼 */}
      {selecting && selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 border-t border-line bg-white p-4 pb-[calc(env(safe-area-inset-bottom)+16px)]">
          <div className="mx-auto max-w-lg">
            <Button
              className="bg-pay active:bg-pay/80"
              onClick={() =>
                setConfirmTarget((photos ?? []).filter((p) => selected.has(p.id)))
              }
            >
              선택한 {selected.size}장 지우기
            </Button>
          </div>
        </div>
      )}

      {/* 사진 크게 보기 */}
      {viewer && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-ink"
          role="dialog"
          aria-modal="true"
          aria-label="사진 보기"
        >
          <div className="flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top)+8px)] pb-2">
            <button
              type="button"
              className="h-11 px-2 text-base font-semibold text-white"
              onClick={() => setViewer(null)}
            >
              ‹ 닫기
            </button>
            <span className="text-sm text-white/70">
              {viewer.photo.taken_at ? formatDate(viewer.photo.taken_at) : ''}
            </span>
            {me === viewer.photo.uploader_id ? (
              <button
                type="button"
                className="h-11 px-2 text-base font-semibold text-white"
                onClick={() => setConfirmTarget([viewer.photo])}
              >
                지우기
              </button>
            ) : (
              <span className="w-14" />
            )}
          </div>
          <div className="flex flex-1 items-center justify-center overflow-hidden">
            {viewer.url ? (
              <img src={viewer.url} alt="" className="max-h-full max-w-full object-contain" />
            ) : (
              <p className="text-white/70">불러오는 중…</p>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmTarget !== null}
        title={confirmTarget && confirmTarget.length > 1 ? `사진 ${confirmTarget.length}장을 지울까요?` : '사진을 지울까요?'}
        message="지운 사진은 되돌릴 수 없어요."
        confirmLabel="지우기"
        danger
        onConfirm={() => {
          if (confirmTarget) remove.mutate(confirmTarget)
          setConfirmTarget(null)
        }}
        onCancel={() => setConfirmTarget(null)}
      />
    </div>
  )
}
