import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

const ToastContext = createContext<(message: string) => void>(() => {})

/** 성공·실패 피드백용 토스트 (DESIGN.md — 3초, 화면당 1개, 새 토스트가 교체) */
// eslint-disable-next-line react-refresh/only-export-components -- context 훅과 provider는 한 쌍
export const useToast = () => useContext(ToastContext)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null)
  const timer = useRef<number>(undefined)

  const show = useCallback((msg: string) => {
    window.clearTimeout(timer.current)
    setMessage(msg)
    timer.current = window.setTimeout(() => setMessage(null), 3000)
  }, [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      {message && (
        <div
          role="status"
          className="fixed bottom-[calc(env(safe-area-inset-bottom)+16px)] left-1/2 z-50 w-max max-w-[calc(100%-40px)] -translate-x-1/2 rounded-xl bg-ink/90 px-4 py-3 text-[15px] text-white"
        >
          {message}
        </div>
      )}
    </ToastContext.Provider>
  )
}
