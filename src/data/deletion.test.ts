import { beforeEach, describe, expect, it, vi } from 'vitest'

const mock = vi.hoisted(() => ({
  photoRows: [] as { storage_path: string; thumb_path: string }[],
  photoDelete: { data: [] as { id: string }[], error: null as Error | null },
  eventDelete: { data: [] as { id: string }[], error: null as Error | null },
  remove: vi.fn(),
}))

vi.mock('./supabase', () => ({
  supabase: {
    from: (table: string) => ({
      select: () => ({
        eq: () =>
          table === 'settlements'
            ? { eq: () => ({ maybeSingle: async () => ({ data: null }) }) }
            : Promise.resolve({ data: mock.photoRows, error: null }),
      }),
      delete: () => ({
        eq: () => ({ select: async () => mock.eventDelete }),
        in: () => ({ select: async () => mock.photoDelete }),
      }),
    }),
    storage: { from: () => ({ remove: mock.remove }) },
  },
}))

import { deletePhotos, type PhotoRow } from './photos'
import { deleteEvent } from './events'

const photo = (id: string): PhotoRow => ({
  id,
  event_id: 'event',
  uploader_id: 'owner',
  storage_path: `${id}.png`,
  thumb_path: `${id}_thumb.png`,
  taken_at: null,
  lat: null,
  lng: null,
  visit_id: null,
  size_bytes: 1,
  created_at: '',
})

beforeEach(() => {
  mock.photoRows = []
  mock.photoDelete = { data: [], error: null }
  mock.eventDelete = { data: [], error: null }
  mock.remove.mockReset().mockResolvedValue({ error: null })
})

describe('deletePhotos', () => {
  it('타인 행 삭제가 0건이면 파일을 지우지 않고 거부한다', async () => {
    await expect(deletePhotos([photo('other')])).rejects.toThrow()
    expect(mock.remove).not.toHaveBeenCalled()
  })

  it('혼합 선택은 실제 삭제된 행의 파일만 정리하고 부분 삭제를 알린다', async () => {
    mock.photoDelete.data = [{ id: 'own' }]
    await expect(deletePhotos([photo('own'), photo('other')])).rejects.toMatchObject({
      name: 'DeletePartialError',
      phase: 'rows',
      deletedCount: 1,
    })
    expect(mock.remove).toHaveBeenCalledExactlyOnceWith(['own.png', 'own_thumb.png'])
  })

  it('행 삭제 후 파일 정리 실패를 부분 삭제로 전달한다', async () => {
    mock.photoDelete.data = [{ id: 'own' }]
    mock.remove.mockResolvedValue({ error: new Error('Storage denied') })
    await expect(deletePhotos([photo('own')])).rejects.toMatchObject({
      name: 'DeletePartialError',
      phase: 'storage',
      deletedCount: 1,
    })
  })

  it('행과 파일이 모두 삭제되면 성공한다', async () => {
    mock.photoDelete.data = [{ id: 'own' }]
    await expect(deletePhotos([photo('own')])).resolves.toBeUndefined()
    expect(mock.remove).toHaveBeenCalledExactlyOnceWith(['own.png', 'own_thumb.png'])
  })
})

describe('deleteEvent', () => {
  it('기록 삭제가 0건이면 사진 파일을 지우지 않고 거부한다', async () => {
    mock.photoRows = [{ storage_path: 'own.png', thumb_path: 'own_thumb.png' }]
    await expect(deleteEvent('event')).rejects.toThrow()
    expect(mock.remove).not.toHaveBeenCalled()
  })

  it('기록 삭제 후 파일 정리 실패를 부분 삭제로 전달한다', async () => {
    mock.photoRows = [{ storage_path: 'own.png', thumb_path: 'own_thumb.png' }]
    mock.eventDelete.data = [{ id: 'event' }]
    mock.remove.mockResolvedValue({ error: new Error('Storage denied') })
    await expect(deleteEvent('event')).rejects.toMatchObject({
      name: 'DeletePartialError',
      phase: 'storage',
      deletedCount: 1,
    })
  })

  it('기록과 사진 파일이 모두 삭제되면 성공한다', async () => {
    mock.photoRows = [{ storage_path: 'own.png', thumb_path: 'own_thumb.png' }]
    mock.eventDelete.data = [{ id: 'event' }]
    await expect(deleteEvent('event')).resolves.toBeUndefined()
    expect(mock.remove).toHaveBeenCalledExactlyOnceWith(['own.png', 'own_thumb.png'])
  })
})
