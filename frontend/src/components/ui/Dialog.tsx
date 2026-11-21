import { useEffect, useRef } from 'react'
import type { ComponentProps } from 'react'

type DialogProps = Omit<ComponentProps<'dialog'>, 'onClose' | 'open'> & {
  onClose: () => void
  closeDisabled?: boolean
  dismissOnBackdrop?: boolean
}

/** Native modality, dismissal, focus containment and focus return for every overlay. */
export function Dialog({ onClose, closeDisabled = false, dismissOnBackdrop = true, children, ref, ...props }: DialogProps) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const element = dialog.current!
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const overflow = document.body.style.overflow
    element.showModal()
    document.body.style.overflow = 'hidden'
    return () => {
      element.close()
      document.body.style.overflow = overflow
      if (previous?.isConnected) previous.focus({ preventScroll: true })
    }
  }, [])

  return <dialog {...props} ref={element => {
    dialog.current = element
    if (typeof ref === 'function') return ref(element)
    if (ref) ref.current = element
  }} onCancel={event => {
    event.preventDefault()
    if (!closeDisabled) onClose()
  }} onKeyDownCapture={event => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      if (!closeDisabled) onClose()
      return
    }
    if (event.key !== 'Tab') return
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
      'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
    )).filter(element => element.getClientRects().length > 0 && !element.closest('[hidden], [inert]'))
    const first = items[0], last = items.at(-1)
    const index = items.indexOf(document.activeElement as HTMLElement)
    if (event.shiftKey && index <= 0) { event.preventDefault(); last?.focus() }
    else if (!event.shiftKey && (index < 0 || document.activeElement === last)) { event.preventDefault(); first?.focus() }
  }} onClick={event => {
    if (!dismissOnBackdrop || closeDisabled || event.target !== event.currentTarget) return
    const bounds = event.currentTarget.getBoundingClientRect()
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose()
  }}>{children}</dialog>
}
