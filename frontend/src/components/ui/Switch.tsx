import type { ComponentProps } from 'react'
import './Switch.css'

export function Switch({ className = '', ...props }: Omit<ComponentProps<'input'>, 'type'>) {
  return <input {...props} className={`tg-switch ${className}`} type="checkbox" role="switch" />
}
