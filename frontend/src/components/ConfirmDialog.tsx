import type { ReactNode } from 'react'
import { useEffect, useRef } from 'react'
import { Button } from './ui/Button'
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
  const dialog = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialog.current?.querySelector<HTMLButtonElement>('.tg-confirm-cancel')?.focus()
    return () => { if (previous?.isConnected) previous.focus() }
  }, [])
  return (
    <div className="tg-confirm-scrim" role="presentation" onClick={() => { if (!busy) onCancel() }}>
      <div ref={dialog} className="tg-confirm-dialog" role="alertdialog" aria-modal="true" aria-label={title}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={event => {
          if (event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            if (!busy) onCancel()
          }
          if (event.key !== 'Tab') return
          const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href]')]
          const first = controls[0], last = controls.at(-1)
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
        }}>
        <h2>{title}</h2>
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
      </div>
    </div>
  )
}
