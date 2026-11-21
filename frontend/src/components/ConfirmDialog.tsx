import type { ReactNode } from 'react'
import { Button } from './ui/Button'
import { Modal } from './ui/Modal'
import './ConfirmDialog.css'

export interface ConfirmDialogProps {
  title: string
  description?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
  children?: ReactNode
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
  children,
}: ConfirmDialogProps) {
  return (
    <Modal title={title} onClose={onCancel} closeDisabled={busy} className="tg-confirm-dialog" role="alertdialog">
      {description && <p>{description}</p>}
      {children}
      <div className="tg-confirm-actions">
        <Button variant="secondary" className="tg-confirm-cancel" onClick={onCancel} disabled={busy}>
          {cancelLabel}
        </Button>
        <Button
          variant={destructive ? 'danger' : 'primary'}
          className="tg-confirm-confirm"
          onClick={onConfirm}
          disabled={busy}
        >
          {busy ? 'Please wait…' : confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}
