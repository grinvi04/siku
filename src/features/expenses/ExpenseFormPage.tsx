import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/Button'
import { Chip } from '@/components/Chip'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Input } from '@/components/Input'
import { useToast } from '@/components/Toast'
import { getEvent } from '@/data/events'
import { createExpense, deleteExpense, getExpense, updateExpense } from '@/data/expenses'
import { useSession } from '@/features/auth/useSession'
import { recognizeReceipt } from '@/services/web/receiptOcr'

/** 지출 추가(/expenses/new)와 수정(/expenses/:expenseId/edit)을 한 폼으로 */
export function ExpenseFormPage() {
  const { eventId, expenseId } = useParams<{ eventId: string; expenseId?: string }>()
  const isEdit = !!expenseId
  const { session } = useSession()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const { data: event } = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => getEvent(eventId!),
    enabled: !!eventId,
  })
  const { data: existing } = useQuery({
    queryKey: ['expense', expenseId],
    queryFn: () => getExpense(expenseId!),
    enabled: isEdit,
  })

  const [isRefund, setIsRefund] = useState<boolean | null>(null)
  const [payerId, setPayerId] = useState<string | null>(null)
  const [touched, setTouched] = useState<Set<string> | null>(null)
  const [titleValue, setTitleValue] = useState<string | null>(null)
  const [amountValue, setAmountValue] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const receiptInputRef = useRef<HTMLInputElement>(null)

  // 기본값: 수정이면 기존 값, 추가면 결제자=나·참여자=전원·지출
  const refund = isRefund ?? (existing ? existing.amount < 0 : false)
  const payer = payerId ?? existing?.payer_id ?? session?.user.id ?? null
  const title = titleValue ?? existing?.title ?? ''
  const amount = amountValue ?? (existing ? String(Math.abs(existing.amount)) : '')

  const handleReceipt = async (file: File) => {
    setScanning(true)
    try {
      const parsed = await recognizeReceipt(file)
      if (!parsed.title && !parsed.amount) {
        toast('영수증에서 정보를 찾지 못했어요. 직접 입력해 주세요')
        return
      }
      if (parsed.title) setTitleValue(parsed.title)
      if (parsed.amount) setAmountValue(String(parsed.amount))
      toast('영수증을 읽었어요. 내용과 금액을 확인해 주세요')
    } catch {
      toast('영수증을 읽지 못했어요. 직접 입력해 주세요')
    } finally {
      setScanning(false)
    }
  }
  const participantIds =
    touched ??
    new Set(
      (existing ? existing.participants : (event?.participants ?? [])).map((p) => p.user_id),
    )

  const toggleParticipant = (userId: string) => {
    const next = new Set(participantIds)
    if (next.has(userId)) next.delete(userId)
    else next.add(userId)
    setTouched(next)
  }

  const goBack = () => navigate(`/events/${eventId}`, { replace: true })
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['expenses', eventId] })
    void queryClient.invalidateQueries({ queryKey: ['expense', expenseId] })
  }

  const save = useMutation({
    mutationFn: (input: Parameters<typeof createExpense>[0]) =>
      isEdit ? updateExpense(expenseId!, input) : createExpense(input),
    onSuccess: () => {
      invalidate()
      toast(isEdit ? '지출을 고쳤어요' : '지출을 추가했어요')
      goBack()
    },
    onError: () => toast('저장하지 못했어요. 다시 시도해 주세요'),
  })
  const remove = useMutation({
    mutationFn: () => deleteExpense(expenseId!),
    onSuccess: () => {
      invalidate()
      toast('지출을 지웠어요')
      goBack()
    },
    onError: () => toast('지우지 못했어요. 다시 시도해 주세요'),
  })

  if (!event || (isEdit && !existing)) {
    return <p className="px-5 pt-24 text-center text-ink-soft">불러오는 중…</p>
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const title = String(form.get('title') ?? '').trim()
    const raw = Number(String(form.get('amount') ?? '').replaceAll(',', ''))
    if (!title || !payer) return
    if (!Number.isInteger(raw) || raw <= 0) {
      toast('금액은 1원 이상 숫자로 입력해 주세요')
      return
    }
    if (participantIds.size === 0) {
      toast('나눌 사람을 한 명 이상 선택해 주세요')
      return
    }
    save.mutate({
      eventId: eventId!,
      payerId: payer,
      title,
      amount: refund ? -raw : raw,
      participantIds: [...participantIds],
    })
  }

  return (
    <form
      className="min-h-dvh px-5 pt-6 pb-[calc(env(safe-area-inset-bottom)+16px)]"
      onSubmit={handleSubmit}
    >
      <button type="button" className="h-11 text-base text-ink-soft" onClick={goBack}>
        ‹ 뒤로
      </button>
      <h1 className="mt-2 text-[22px] font-bold">{isEdit ? '지출 고치기' : '지출 추가'}</h1>

      <div className="mt-6 space-y-5">
        <div>
          <span className="mb-1.5 block text-sm text-ink-soft">종류</span>
          <div className="flex gap-2">
            <Chip selected={!refund} onClick={() => setIsRefund(false)}>
              쓴 돈
            </Chip>
            <Chip selected={refund} onClick={() => setIsRefund(true)}>
              돌려받은 돈 (환불·환급)
            </Chip>
          </div>
        </div>

        {!refund && (
          <div>
            <input
              ref={receiptInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (file) void handleReceipt(file)
              }}
            />
            <Button
              type="button"
              variant="secondary"
              disabled={scanning}
              onClick={() => receiptInputRef.current?.click()}
            >
              {scanning ? '영수증을 읽고 있어요…' : '영수증 찍어서 자동 입력'}
            </Button>
          </div>
        )}

        <Input
          id="title"
          name="title"
          label="내용"
          placeholder={refund ? '예: 숙소 보증금 환급' : '예: 저녁 식사, 숙소'}
          value={title}
          onChange={(e) => setTitleValue(e.target.value)}
          required
        />
        <Input
          id="amount"
          name="amount"
          label="금액 (원)"
          inputMode="numeric"
          placeholder="예: 120000"
          value={amount}
          onChange={(e) => setAmountValue(e.target.value)}
          required
        />

        <div>
          <span className="mb-1.5 block text-sm text-ink-soft">
            {refund ? '누가 돌려받았나요?' : '누가 결제했나요?'}
          </span>
          <div className="flex flex-wrap gap-2">
            {event.participants.map((p) => (
              <Chip
                key={p.user_id}
                selected={payer === p.user_id}
                onClick={() => setPayerId(p.user_id)}
              >
                {p.display_name}
                {p.user_id === session?.user.id && ' (나)'}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <span className="mb-1.5 block text-sm text-ink-soft">
            누구 몫인가요? — 누르면 뺄 수 있어요
          </span>
          <div className="flex flex-wrap gap-2">
            {event.participants.map((p) => (
              <Chip
                key={p.user_id}
                selected={participantIds.has(p.user_id)}
                onClick={() => toggleParticipant(p.user_id)}
              >
                {p.display_name}
                {p.user_id === session?.user.id && ' (나)'}
              </Chip>
            ))}
          </div>
          <p className="mt-1.5 text-sm text-ink-soft">선택한 사람들끼리 똑같이 나눠요.</p>
        </div>
      </div>

      <div className="mt-8 space-y-3">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? '저장하고 있어요…' : isEdit ? '고치기' : '추가'}
        </Button>
        {isEdit && (
          <button
            type="button"
            className="h-11 w-full text-base font-semibold text-pay"
            onClick={() => setConfirmDelete(true)}
          >
            이 지출 지우기
          </button>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="지출을 지울까요?"
        message="지운 지출은 되돌릴 수 없어요."
        confirmLabel="지우기"
        danger
        onConfirm={() => {
          setConfirmDelete(false)
          remove.mutate()
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </form>
  )
}
