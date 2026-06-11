import { Component, type ReactNode } from 'react'

/** 렌더링 오류로 빈 화면이 되는 것을 방지 (react.dev 권장 — 프로덕션 에러 바운더리) */
export class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-dvh flex-col items-center justify-center px-5 text-center">
          <p className="text-base leading-[1.55] text-ink-soft">
            문제가 생겨 화면을 표시하지 못했어요.
            <br />
            새로고침하면 대부분 해결돼요.
          </p>
          <button
            type="button"
            className="mt-6 h-13 rounded-xl bg-primary px-8 text-base font-semibold text-white"
            onClick={() => window.location.reload()}
          >
            새로고침
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
