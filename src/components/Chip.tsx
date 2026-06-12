import type { ButtonHTMLAttributes } from 'react'

/** 선택 토글 칩 (DESIGN.md — 참여자·종류 선택) */
export function Chip({
  selected,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { selected: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={`h-11 rounded-full px-4 text-base transition-colors ${
        selected ? 'bg-primary-container font-semibold text-primary' : 'bg-surface text-ink-soft'
      } ${className}`}
      {...props}
    />
  )
}
