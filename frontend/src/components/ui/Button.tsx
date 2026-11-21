import type { ComponentProps } from 'react'
import './Button.css'

type ButtonProps = ComponentProps<'button'> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'tinted' | 'light'
  appearance?: 'glass' | 'flat' | 'icon'
  size?: 'sm' | 'md' | 'lg'
  /** Stretches the button to fill its grid/flex cell. */
  block?: boolean
}

export function Button({
  variant = 'primary',
  appearance = 'glass',
  size = 'md',
  block = false,
  className = '',
  type = 'button',
  ...props
}: ButtonProps) {
  const material = appearance === 'flat' ? 'tg-button--flat' : `tg-control tg-control--${variant}`
  const classes = [
    'tg-button',
    `tg-button--${variant}`,
    `tg-button--${size}`,
    material,
    appearance === 'icon' ? 'tg-icon-button' : '',
    block ? 'tg-button--block' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')
  return <button type={type} className={classes} {...props} />
}
