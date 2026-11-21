import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'

export function Modal({
  title,
  onClose,
  children,
  className = '',
  closeDisabled = false,
  role,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  className?: string
  closeDisabled?: boolean
  role?: 'alertdialog'
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const element = ref.current
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    element?.showModal()
    return () => {
      element?.close()
      previous?.focus()
    }
  }, [])
  return (
    <dialog
      ref={ref}
      className={`sp-dialog ${className}`}
      aria-label={title}
      role={role}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return
        const items = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((element) => element.getClientRects().length > 0)
        const first = items[0]
        const last = items.at(-1)
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last?.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first?.focus()
        }
      }}
      onCancel={(event) => {
        event.preventDefault()
        if (!closeDisabled) onClose()
      }}
      onClick={(event) => {
        if (event.target === ref.current) {
          const bounds = ref.current.getBoundingClientRect()
          if (
            event.clientX < bounds.left ||
            event.clientX > bounds.right ||
            event.clientY < bounds.top ||
            event.clientY > bounds.bottom
          )
            if (!closeDisabled) onClose()
        }
      }}
    >
      <header>
        <div>
          <h2>{title}</h2>
        </div>
        <button className="sp-icon tg-control" aria-label="Close dialog" onClick={onClose} disabled={closeDisabled}>
          ×
        </button>
      </header>
      {children}
    </dialog>
  )
}
