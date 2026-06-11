import type { InputHTMLAttributes } from 'react'

export function Input({
  label,
  className = '',
  id,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <label className="block" htmlFor={id}>
      {label && <span className="mb-1.5 block text-[13px] text-ink-soft">{label}</span>}
      <input
        id={id}
        className={`h-13 w-full rounded-xl bg-surface px-4 text-base text-ink outline-none placeholder:text-ink-faint focus:ring-[1.5px] focus:ring-primary ${className}`}
        {...props}
      />
    </label>
  )
}
