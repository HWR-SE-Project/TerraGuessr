import type { ButtonHTMLAttributes } from 'react'

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  'aria-label': string
}

export function IconButton({ className = '', type = 'button', ...props }: IconButtonProps) {
  return (
    <button type={type} className={`tg-icon-button tg-control ${className}`} {...props} />
  )
}
