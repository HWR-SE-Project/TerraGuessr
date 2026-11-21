import type { ReactNode } from 'react'
import { Dialog } from './Dialog'
import { IconButton } from './IconButton'
import './Modal.css'

/** Standard dialog shell; specialized overlays compose Dialog directly. */
export function Modal({ title, onClose, children, className = '', closeDisabled = false, role }: {
  title: string
  onClose: () => void
  children: ReactNode
  className?: string
  closeDisabled?: boolean
  role?: 'alertdialog'
}) {
  return <Dialog className={`tg-dialog tg-glass ${className}`} aria-label={title}
    role={role} onClose={onClose} closeDisabled={closeDisabled}>
    <header>
      <h2>{title}</h2>
      <IconButton className="tg-dialog-close" aria-label="Close dialog" onClick={onClose} disabled={closeDisabled}>×</IconButton>
    </header>
    {children}
  </Dialog>
}
