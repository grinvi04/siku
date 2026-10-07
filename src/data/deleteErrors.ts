/** DB 삭제가 이미 반영되어 호출자가 화면 상태를 갱신해야 하는 실패. */
export class DeletePartialError extends Error {
  readonly phase: 'rows' | 'storage'
  readonly deletedCount: number
  readonly requestedCount: number

  constructor(
    phase: 'rows' | 'storage',
    deletedCount: number,
    requestedCount: number,
    cause?: Error,
  ) {
    super('삭제가 일부만 완료됐습니다.', { cause })
    this.name = 'DeletePartialError'
    this.phase = phase
    this.deletedCount = deletedCount
    this.requestedCount = requestedCount
  }
}
