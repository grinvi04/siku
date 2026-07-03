import { Button } from './Button'

/** 파괴적 행동 전 확인 (DESIGN.md — 토스트가 아니라 다이얼로그 먼저) */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  danger = false,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-5"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-[0_8px_24px_rgba(26,32,44,0.16)]">
        <h2 className="text-[19px] font-semibold">{title}</h2>
        <p className="mt-2 text-base leading-[1.55] text-ink-soft">{message}</p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={onCancel}>
            취소
          </Button>
          <Button onClick={onConfirm} className={danger ? 'bg-pay active:bg-pay/80' : undefined}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
