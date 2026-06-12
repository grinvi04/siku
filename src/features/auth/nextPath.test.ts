import { describe, expect, it } from 'vitest'
import { sanitizeNextPath } from './nextPath'

describe('sanitizeNextPath', () => {
  it('초대 딥링크만 보존한다', () => {
    expect(sanitizeNextPath('/invite/abc123')).toBe('/invite/abc123')
  })

  it('초대 외 내부 경로는 버린다 — 로그인 후 항상 메인', () => {
    expect(sanitizeNextPath('/profile')).toBeUndefined()
    expect(sanitizeNextPath('/groups/xyz')).toBeUndefined()
    expect(sanitizeNextPath('/')).toBeUndefined()
  })

  it('외부 URL·프로토콜 상대 경로는 버린다 (open redirect 방지)', () => {
    expect(sanitizeNextPath('https://evil.example.com')).toBeUndefined()
    expect(sanitizeNextPath('//evil.example.com')).toBeUndefined()
    expect(sanitizeNextPath('javascript:alert(1)')).toBeUndefined()
  })

  it('dot-segment 경로 트릭은 정규화 후 검증한다', () => {
    expect(sanitizeNextPath('/invite/../profile')).toBeUndefined()
    expect(sanitizeNextPath('/invite/..//evil.com')).toBeUndefined()
    expect(sanitizeNextPath('/invite/abc/../def')).toBe('/invite/def')
  })

  it('외부 URL이라도 /invite/ 경로면 내부 pathname만 보존한다', () => {
    expect(sanitizeNextPath('https://evil.example.com/invite/abc')).toBe('/invite/abc')
  })

  it('빈 값은 undefined', () => {
    expect(sanitizeNextPath(null)).toBeUndefined()
    expect(sanitizeNextPath('')).toBeUndefined()
  })
})
