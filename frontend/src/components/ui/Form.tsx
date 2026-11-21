import { forwardRef } from 'react'
import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react'
import { motion } from 'framer-motion'
import { Icon } from './Icon'
import type { IconName } from './Icon'

interface FieldProps {
  label?: string
  htmlFor?: string
  hint?: string
  error?: string | null
  children: ReactNode
}

/** Label + control + hint/error wrapper for consistent form spacing. */
export function Field({ label, htmlFor, hint, error, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={htmlFor} className="text-sm font-bold text-cream/90">
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p role="alert" className="text-sm font-semibold text-rose-300">
          {error}
        </p>
      ) : hint ? (
        <p className="text-sm text-subtle">{hint}</p>
      ) : null}
    </div>
  )
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: IconName
  error?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { icon, error, className = '', ...props },
  ref,
) {
  return (
    <div className="relative">
      {icon && (
        <Icon
          name={icon}
          size={18}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-subtle"
        />
      )}
      <input
        ref={ref}
        className={`field-base ${icon ? 'pl-10' : ''} ${error ? 'border-rose-400/60' : ''} ${className}`}
        {...props}
      />
    </div>
  )
})

export function Textarea({
  className = '',
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`field-base min-h-24 resize-y ${className}`} {...props} />
}

/** A friendly pill switch. */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
        checked ? 'bg-lime-400' : 'bg-space-500'
      } ${disabled ? 'opacity-45' : ''}`}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 32 }}
        className={`inline-block size-5 rounded-full shadow ${checked ? 'ml-6 bg-ink' : 'ml-1 bg-cream'}`}
      />
    </button>
  )
}

/** Accessible range slider styled to match the system. */
export function Slider({
  value,
  onChange,
  min = 0,
  max = 100,
  label,
  disabled,
}: {
  value: number
  onChange: (next: number) => void
  min?: number
  max?: number
  label: string
  disabled?: boolean
}) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      value={value}
      disabled={disabled}
      aria-label={label}
      onChange={(event) => onChange(Number(event.target.value))}
      className="h-2 w-full cursor-pointer appearance-none rounded-full bg-space-500 accent-lime-400"
      style={{
        backgroundImage: `linear-gradient(90deg, var(--color-lime-400) ${((value - min) / (max - min)) * 100}%, var(--color-space-500) 0)`,
      }}
    />
  )
}
