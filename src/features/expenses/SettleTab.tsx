import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/Button'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useToast } from '@/components/Toast'
import { computeBalances, settle } from '@/core/settlement'
import type { EventDetail } from '@/data/events'
import { listExpenses, toCoreExpense } from '@/data/expenses'
import {
  closeSettlement,
  getAccounts,
  getClosedSettlement,
  getPrepaidTransfers,
  markTransfer,
  reopenSettlement,
  type TransferRow,
  type TransferStatus,
} from '@/data/settlements'
import { formatDateTime, formatKrw } from '@/lib/format'
import { Check, Lock, ReceiptText, RotateCcw } from 'lucide-react'
import { useSession } from '@/features/auth/useSession'

export function SettleTab({ event }: { event: EventDetail }) {
  const { session } = useSession()
  const me = session?.user.id
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [confirmAction, setConfirmAction] = useState<'close' | 'reopen' | null>(null)

  const { data: expenses } = useQuery({
    queryKey: ['expenses', event.id],
    queryFn: () => listExpenses(event.id),
  })
  const { data: closed, isLoading: closedLoading } = useQuery({
    queryKey: ['settlement', event.id],
    queryFn: () => getClosedSettlement(event.id),
  })
  const { data: prepaid } = useQuery({
    queryKey: ['prepaid', event.id],
    queryFn: () => getPrepaidTransfers(event.id),
  })

  // 미리보기(미확정) 또는 확정 이체의 모든 당사자 계좌·이름
  const preview = useMemo(() => {
    if (!expenses || expenses.length === 0 || !prepaid) return null
    try {
      const balances = computeBalances(expenses.map(toCoreExpense), prepaid)
      return { balances, transfers: settle(balances) }
    } catch {
      return null // 데이터 불일치 — 지출을 수정하면 다시 계산됨
    }
  }, [expenses, prepaid])

  const partyIds = useMemo(() => {
    const ids = new Set<string>()
    for (const t of closed?.transfers ?? []) {
      ids.add(t.from_user)
      ids.add(t.to_user)
    }
    for (const t of preview?.transfers ?? []) {
      ids.add(t.fromUser)
      ids.add(t.toUser)
    }
    for (const p of event.participants) ids.add(p.user_id)
    return [...ids]
  }, [closed, preview, event.participants])

  const { data: accounts } = useQuery({
    queryKey: ['accounts', partyIds.sort().join(',')],
    queryFn: () => getAccounts(partyIds),
    enabled: partyIds.length > 0,
  })

  const nameOf = (id: string) =>
    accounts?.get(id)?.display_name ??
    event.participants.find((p) => p.user_id === id)?.display_name ??
    '멤버'

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['expenses', event.id] })
    void queryClient.invalidateQueries({ queryKey: ['settlement', event.id] })
    void queryClient.invalidateQueries({ queryKey: ['prepaid', event.id] })
  }

  const close = useMutation({
    mutationFn: () => closeSettlement(event.id, preview?.transfers ?? []),
    onSuccess: () => {
      invalidate()
      toast('정산을 확정했어요. 이제 송금만 하면 돼요')
    },
    onError: async (e) => {
      // 다른 멤버가 먼저 확정한 경우 — 오류가 아니라 상태가 바뀐 것
      if (e instanceof Error && e.message.includes('이미 확정된')) {
        const latest = await getClosedSettlement(event.id).catch(() => null)
        invalidate()
        const who = latest?.closed_by ? `${nameOf(latest.closed_by)}님이` : '다른 멤버가'
        toast(`${who} 이미 정산을 확정했어요. 최신 내용을 불러왔어요`)
      } else {
        toast('정산을 확정하지 못했어요. 다시 시도해 주세요')
      }
    },
  })
  const reopen = useMutation({
    mutationFn: () => reopenSettlement(event.id),
    onSuccess: () => {
      invalidate()
      toast('정산을 취소했어요. 이미 받은 송금은 다음 확정에서 빼고 계산해요')
    },
    onError: (e) => {
      // 다른 멤버가 먼저 취소한 경우
      if (e instanceof Error && e.message.includes('확정된 정산이 없')) {
        invalidate()
        toast('이미 정산이 취소된 상태예요. 최신 내용을 불러왔어요')
      } else {
        toast('정산을 취소하지 못했어요. 다시 시도해 주세요')
      }
    },
  })
  const mark = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TransferStatus }) =>
      markTransfer(id, status),
    onSuccess: (_, { status }) => {
      invalidate()
      toast(
        status === 'sent'
          ? '보냈다고 표시했어요'
          : status === 'confirmed'
            ? '받았다고 확인했어요'
            : '되돌렸어요',
      )
    },
    onError: () => toast('처리하지 못했어요. 다시 시도해 주세요'),
  })

  const copyAccount = async (userId: string) => {
    const account = accounts?.get(userId)
    if (!account?.account_number) {
      toast(`${nameOf(userId)}님이 아직 계좌를 등록하지 않았어요`)
      return
    }
    await navigator.clipboard.writeText(
      [account.bank_name, account.account_number].filter(Boolean).join(' '),
    )
    toast('계좌번호를 복사했어요. 은행 앱에 붙여넣으세요')
  }

  const isLocked = !!closed
  const total = (expenses ?? []).reduce((s, e) => s + e.amount, 0)

  return (
    <div className="mt-6">
      {/* 지출 목록 */}
      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-[19px] font-semibold">쓴 돈</h2>
          {expenses && expenses.length > 0 && (
            <span className="amount text-[19px]">{formatKrw(total)}</span>
          )}
        </div>
        {isLocked && (
          <p className="mt-1 flex items-center gap-1 text-sm text-ink-soft">
            <Lock size={14} className="shrink-0" /> 정산이 확정되어 잠겨 있어요
          </p>
        )}
        {expenses && expenses.length > 0 ? (
          <ul className="mt-1">
            {expenses.map((expense) => {
              const row = (
                <div className="flex min-h-14 items-center justify-between py-3">
                  <div>
                    <p className="text-base font-semibold">
                      {expense.title}
                      {expense.amount < 0 && (
                        <span className="ml-1.5 rounded-md bg-primary-container px-1.5 py-0.5 text-sm font-semibold text-primary">
                          환불
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-sm text-ink-soft">
                      {nameOf(expense.payer_id)} 결제 · {expense.participants.length}명
                    </p>
                  </div>
                  <span className="amount text-base">{formatKrw(expense.amount)}</span>
                </div>
              )
              return (
                <li key={expense.id} className="border-b border-line">
                  {isLocked ? (
                    row
                  ) : (
                    <Link to={`/events/${event.id}/expenses/${expense.id}/edit`}>{row}</Link>
                  )}
                </li>
              )
            })}
          </ul>
        ) : (
          <div className="mt-8 text-center">
            <ReceiptText size={36} className="mx-auto text-ink-faint" />
            <p className="mt-2 text-base text-ink-soft">아직 등록한 지출이 없어요.</p>
          </div>
        )}
        {!isLocked && (
          <div className="mt-4">
            <Button
              variant="secondary"
              onClick={() => navigate(`/events/${event.id}/expenses/new`)}
            >
              지출 추가
            </Button>
          </div>
        )}
      </section>

      {/* 정산 영역 */}
      <section className="mt-8">
        <h2 className="text-[19px] font-semibold">정산</h2>

        {closedLoading ? null : closed ? (
          <>
            <p className="mt-1 text-sm text-ink-soft">
              {formatDateTime(closed.created_at)}
              {closed.closed_by && ` · ${nameOf(closed.closed_by)}님이 확정했어요`}
            </p>
            {closed.transfers.length === 0 ? (
              <p className="mt-2 text-base text-ink-soft">주고받을 돈 없이 정산이 끝났어요.</p>
            ) : (
              <>
                <p className="mt-1 text-sm text-ink-soft">
                  송금 {closed.transfers.length}건 중{' '}
                  <span className="font-semibold text-success">
                    {closed.transfers.filter((t) => t.status === 'confirmed').length}건 완료
                  </span>
                  {closed.transfers.some((t) => t.status === 'sent') &&
                    ` · ${closed.transfers.filter((t) => t.status === 'sent').length}건 확인 대기`}
                </p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface">
                  <div
                    className="h-full rounded-full bg-success transition-all"
                    style={{
                      width: `${Math.round((closed.transfers.filter((t) => t.status === 'confirmed').length / closed.transfers.length) * 100)}%`,
                    }}
                  />
                </div>
                <ul className="mt-1">
                {closed.transfers.map((t) => (
                  <TransferItem
                    key={t.id}
                    transfer={t}
                    me={me}
                    nameOf={nameOf}
                    holder={accounts?.get(t.to_user)?.account_holder ?? null}
                    onCopy={() => void copyAccount(t.to_user)}
                    onMark={(status) => mark.mutate({ id: t.id, status })}
                  />
                ))}
                </ul>
              </>
            )}
            <button
              type="button"
              className="mt-4 h-11 w-full text-base font-semibold text-pay"
              onClick={() => setConfirmAction('reopen')}
            >
              정산 취소
            </button>
          </>
        ) : preview && expenses && expenses.length > 0 ? (
          <>
            <ul className="mt-1">
              {[...preview.balances]
                .filter(([, v]) => v !== 0)
                .sort((a, b) => b[1] - a[1])
                .map(([userId, balance]) => (
                  <li
                    key={userId}
                    className="flex min-h-12 items-center justify-between border-b border-line py-2"
                  >
                    <span
                      className={`text-base ${userId === me ? 'font-semibold text-primary' : ''}`}
                    >
                      {nameOf(userId)}
                    </span>
                    <span className={`amount text-base ${balance > 0 ? 'text-receive' : 'text-pay'}`}>
                      {balance > 0 ? `+${formatKrw(balance)} 받아요` : `${formatKrw(balance)} 보내요`}
                    </span>
                  </li>
                ))}
            </ul>
            {preview.transfers.length > 0 && (
              <div className="mt-3 rounded-2xl bg-surface p-4">
                <p className="text-sm font-semibold text-ink-soft">이렇게 보내면 끝나요</p>
                <ul className="mt-1 space-y-1">
                  {preview.transfers.map((t) => (
                    <li key={`${t.fromUser}-${t.toUser}`} className="text-base">
                      {nameOf(t.fromUser)} → {nameOf(t.toUser)}{' '}
                      <span className="amount">{formatKrw(t.amount)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-4">
              <Button onClick={() => setConfirmAction('close')}>정산 확정</Button>
            </div>
          </>
        ) : (
          <p className="mt-2 text-base text-ink-soft">지출을 등록하면 여기서 정산해 드려요.</p>
        )}
      </section>

      <ConfirmDialog
        open={confirmAction === 'close'}
        title="정산을 확정할까요?"
        message="확정하면 지출 내역이 잠기고, 멤버별 보낼 금액이 정해져요."
        confirmLabel="확정"
        onConfirm={() => {
          setConfirmAction(null)
          close.mutate()
        }}
        onCancel={() => setConfirmAction(null)}
      />
      <ConfirmDialog
        open={confirmAction === 'reopen'}
        title="정산을 취소할까요?"
        message="지출을 다시 고칠 수 있게 돼요. 이미 받았다고 확인된 송금은 다음 확정에서 자동으로 빼고 계산해요."
        confirmLabel="정산 취소"
        danger
        onConfirm={() => {
          setConfirmAction(null)
          reopen.mutate()
        }}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  )
}

/** 상태 배지는 정보가 있을 때만 — '대기'는 행동 버튼의 존재 자체가 상태라서 표기하지 않는다 */
function StatusBadge({ transfer }: { transfer: TransferRow }) {
  if (transfer.status === 'sent') {
    return (
      <span className="flex items-center gap-1 rounded-md bg-warning/10 px-2 py-1 text-sm font-semibold text-warning">
        보냄
        {transfer.sent_at && (
          <span className="font-normal text-ink-soft">{formatDateTime(transfer.sent_at)}</span>
        )}
      </span>
    )
  }
  if (transfer.status === 'confirmed') {
    return (
      <span className="flex items-center gap-1 rounded-md bg-success/10 px-2 py-1 text-sm font-semibold text-success">
        <Check size={14} /> 완료
        {transfer.confirmed_at && (
          <span className="font-normal text-ink-soft">
            {formatDateTime(transfer.confirmed_at)}
          </span>
        )}
      </span>
    )
  }
  return null
}

function UndoButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="flex h-11 items-center gap-1 rounded-xl bg-surface px-3 text-sm font-semibold text-ink-soft"
      onClick={onClick}
    >
      <RotateCcw size={15} />
      되돌리기
    </button>
  )
}

function TransferItem({
  transfer,
  me,
  nameOf,
  holder,
  onCopy,
  onMark,
}: {
  transfer: TransferRow
  me: string | undefined
  nameOf: (id: string) => string
  holder: string | null
  onCopy: () => void
  onMark: (status: TransferStatus) => void
}) {
  const isSender = me === transfer.from_user
  const isReceiver = me === transfer.to_user
  const done = transfer.status === 'confirmed'

  return (
    <li className="border-b border-line py-3">
      <div className="flex items-center justify-between">
        <span className="text-base">
          <span className={`font-semibold ${isSender ? 'text-primary' : ''}`}>
            {nameOf(transfer.from_user)}
          </span>{' '}
          →{' '}
          <span className={`font-semibold ${isReceiver ? 'text-primary' : ''}`}>
            {nameOf(transfer.to_user)}
          </span>
          {holder && <span className="ml-1 text-sm text-ink-soft">(예금주 {holder})</span>}
        </span>
        <span className={`amount text-base ${done ? 'text-success' : ''}`}>
          {formatKrw(transfer.amount)}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <StatusBadge transfer={transfer} />
        {/* 보내기 전 + 내가 당사자가 아니면 상태를 글로 알려준다 (배지 없는 유일한 경우) */}
        {transfer.status === 'pending' && !isSender && !isReceiver && (
          <span className="text-sm text-ink-soft">아직 보내기 전이에요</span>
        )}
        {!done && isSender && (
          <>
            <button
              type="button"
              className="h-11 rounded-xl bg-surface px-3 text-base font-semibold text-ink"
              onClick={onCopy}
            >
              계좌 복사
            </button>
            {transfer.status === 'pending' ? (
              <button
                type="button"
                className="h-11 rounded-xl bg-primary-container px-3 text-base font-semibold text-primary"
                onClick={() => onMark('sent')}
              >
                보냈어요
              </button>
            ) : (
              <UndoButton onClick={() => onMark('pending')} />
            )}
          </>
        )}
        {!done && isReceiver && (
          <button
            type="button"
            className="h-11 rounded-xl bg-primary-container px-3 text-base font-semibold text-primary"
            onClick={() => onMark('confirmed')}
          >
            받았어요
          </button>
        )}
        {done && isReceiver && (
          <UndoButton onClick={() => onMark(transfer.sent_at ? 'sent' : 'pending')} />
        )}
      </div>
    </li>
  )
}
