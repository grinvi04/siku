import { describe, expect, it, vi } from 'vitest'
import { shareText } from './share'

describe('shareText', () => {
  it('AC-3: Web Share 지원·성공 시 share로 공유하고 복사하지 않는다', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    const copy = vi.fn().mockResolvedValue(undefined)
    const result = await shareText('내용', { share, copy })
    expect(result).toBe('shared')
    expect(share).toHaveBeenCalledWith({ text: '내용' })
    expect(copy).not.toHaveBeenCalled()
  })

  it('AC-4: 공유 실패/취소 시 클립보드로 복사한다', async () => {
    const share = vi.fn().mockRejectedValue(new Error('cancel'))
    const copy = vi.fn().mockResolvedValue(undefined)
    const result = await shareText('내용', { share, copy })
    expect(result).toBe('copied')
    expect(copy).toHaveBeenCalledWith('내용')
  })

  it('AC-4: Web Share 미지원 시 바로 클립보드로 복사한다', async () => {
    const copy = vi.fn().mockResolvedValue(undefined)
    const result = await shareText('내용', { copy })
    expect(result).toBe('copied')
    expect(copy).toHaveBeenCalledWith('내용')
  })
})
