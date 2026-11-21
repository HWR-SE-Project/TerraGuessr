import type { ReactNode } from 'react'
import './InlineNotice.css'

export function InlineNotice({
  tone = 'info',
  children,
  className = '',
}: {
  tone?: 'info' | 'error' | 'success' | 'warning'
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={`tg-notice tg-notice--${tone} ${className}`}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      {children}
    </div>
  )
}
