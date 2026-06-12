import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'text'

const styles: Record<Variant, string> = {
  primary:
    'bg-primary text-white active:bg-primary-pressed disabled:bg-line disabled:text-ink-faint',
  secondary: 'bg-primary-container text-primary active:bg-primary-container/70',
  text: 'bg-transparent text-primary',
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`h-13 w-full rounded-xl text-base font-semibold transition-[background-color,transform] duration-100 active:scale-[0.98] ${styles[variant]} ${className}`}
      {...props}
    />
  )
}
