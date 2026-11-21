import type { ComponentProps } from 'react'
import { Button } from './Button'

type IconButtonProps = ComponentProps<'button'> & { 'aria-label': string }

export function IconButton(props: IconButtonProps) {
  return <Button {...props} appearance="icon" variant="secondary" />
}
