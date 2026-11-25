import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Icon } from './Icon'
import type { IconName } from './Icon'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'tinted'
export type ButtonSize = 'sm' | 'md' | 'lg'

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'btn-press bg-lime-400 text-ink border border-transparent hover:bg-lime-300',
  secondary: 'bg-space-600 text-cream hover:bg-space-500 border border-white/10 shadow-card',
  ghost: 'bg-transparent text-cream hover:bg-white/8 border border-transparent hover:border-white/12',
  danger: 'bg-rose-400/15 text-rose-300 border border-rose-400/30 hover:bg-rose-400/25',
  tinted: 'bg-lime-400/12 text-lime-300 border border-lime-400/30 hover:bg-lime-400/20',
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-9 px-3.5 text-sm rounded-xl',
  md: 'h-12 px-5 text-[1.05rem] rounded-2xl',
  lg: 'h-14 px-7 text-lg rounded-2xl',
}

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: IconName
  trailingIcon?: IconName
  children?: ReactNode
  /** Render as an internal link. */
  to?: string
  /** Render as an external link. */
  href?: string
  fullWidth?: boolean
  loading?: boolean
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  trailingIcon,
  children,
  to,
  href,
  fullWidth,
  loading,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const classes = `btn-base ${VARIANTS[variant]} ${SIZES[size]} ${fullWidth ? 'w-full' : ''} ${className}`
  const content = (
    <>
      {loading ? (
        <Spinner className="size-4" />
      ) : (
        icon && <Icon name={icon} size={size === 'lg' ? 22 : 19} />
      )}
      {children}
      {trailingIcon && !loading && <Icon name={trailingIcon} size={size === 'lg' ? 22 : 19} />}
    </>
  )

  if (to) {
    return (
      <Link to={to} className={classes} aria-disabled={disabled || loading || undefined}>
        {content}
      </Link>
    )
  }
  if (href) {
    return (
      <a href={href} className={classes} target="_blank" rel="noreferrer">
        {content}
      </a>
    )
  }
  return (
    <button
      className={classes}
      disabled={disabled || loading}
      {...props}
    >
      {content}
    </button>
  )
}

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

/** Round icon-only button used in headers, HUDs and overlays. */
export function IconButton({
  name,
  label,
  onClick,
  className = '',
  variant = 'ghost',
  size = 'md',
  disabled = false,
}: {
  name: IconName
  label: string
  onClick?: () => void
  className?: string
  variant?: 'ghost' | 'solid'
  size?: 'sm' | 'md'
  disabled?: boolean
}) {
  const dims = size === 'sm' ? 'size-9' : 'size-11'
  const iconSize = size === 'sm' ? 18 : 20
  const base =
    variant === 'solid'
      ? 'bg-space-600 border border-white/10 text-cream hover:bg-space-500'
      : 'text-cream hover:bg-white/8'
  return (
    <motion.button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.92 }}
      className={`inline-flex items-center justify-center rounded-2xl ${dims} ${base} transition-colors ${className}`}
    >
      <Icon name={name} size={iconSize} />
    </motion.button>
  )
}
