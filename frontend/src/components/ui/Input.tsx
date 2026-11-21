import type { ComponentProps } from 'react'
import './Input.css'

/** Text/password/email fields share one appearance and retain native input semantics. */
export function Input({ className = '', ...props }: ComponentProps<'input'>) {
  return <input className={`tg-field ${className}`} {...props} />
}
