import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { Button } from '@/components/Button'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useToast } from '@/components/Toast'
import type { EventDetail } from '@/data/events'
import {
  deletePhoto,
  getPhotoUrl,
  listPhotos,
  uploadPhotos,
  type PhotoWithUrl,
} from '@/data/photos'
import { formatDate } from '@/lib/format'
import { useSession } from '@/features/auth/useSession'

export function PhotosTab({ event }: { event: EventDetail }) {
  const { session } = useSession()
  const me = session?.user.id
  const queryClient = useQueryClient()
  const toast = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [viewer, setViewer] = useState<{ photo: PhotoWithUrl; url: string | null } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const { data: photos, isLoading } = useQuery({
    queryKey: ['photos', event.id],
    queryFn: () => listPhotos(event.id),
  })

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['photos', event.id] })

  const handleUpload = async (files: File[]) => {
    setProgress({ done: 0, total: files.length })
    try {
      const result = await uploadPhotos(event.group_id, event.id, files, (done, total) =>
        setProgress({ done, total }),
      )
      invalidate()
      if (result.failed === 0) toast(`사진 ${result.uploaded}장을 올렸어요`)
      else toast(`${result.uploaded}장 성공, ${result.failed}장은 올리지 못했어요`)
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

  const remove = useMutation({
    mutationFn: deletePhoto,
    onSuccess: () => {
      invalidate()
      setViewer(null)
      toast('사진을 지웠어요')
    },
    onError: () => toast('지우지 못했어요. 다시 시도해 주세요'),
  })

  return (
    <div className="mt-6">
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
      <Button
        variant="secondary"
        disabled={!!progress}
        onClick={() => fileInputRef.current?.click()}
      >
        {progress ? `올리는 중… ${progress.done}/${progress.total}` : '사진 올리기'}
      </Button>

      {isLoading ? (
        <p className="mt-8 text-center text-ink-soft">불러오는 중…</p>
      ) : photos && photos.length > 0 ? (
        <div className="mt-4 grid grid-cols-3 gap-0.5">
          {photos.map((photo) => (
            <button
              key={photo.id}
              type="button"
              className="aspect-square overflow-hidden bg-surface"
              onClick={() => void openViewer(photo)}
            >
              <img
                src={photo.thumbUrl}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      ) : (
        <p className="mt-8 text-center text-base text-ink-soft">
          아직 사진이 없어요. 모임에서 찍은 사진을 올려 보세요.
        </p>
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
                onClick={() => setConfirmDelete(true)}
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
        open={confirmDelete}
        title="사진을 지울까요?"
        message="지운 사진은 되돌릴 수 없어요."
        confirmLabel="지우기"
        danger
        onConfirm={() => {
          setConfirmDelete(false)
          if (viewer) remove.mutate(viewer.photo)
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  )
}
