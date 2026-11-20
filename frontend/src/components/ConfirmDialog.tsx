import type { ReactNode } from 'react'
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
    <div className="tg-confirm-scrim" role="presentation" onClick={onCancel}>
      <div className="tg-confirm-dialog" role="alertdialog" aria-modal="true" aria-label={title} onClick={(event) => event.stopPropagation()}>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
        {children}
        <div className="tg-confirm-actions">
          <button type="button" className="tg-confirm-cancel tg-control" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={destructive ? 'tg-confirm-confirm tg-control tg-control--danger tg-confirm-confirm--destructive' : 'tg-confirm-confirm tg-control tg-control--primary'}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Please wait…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
