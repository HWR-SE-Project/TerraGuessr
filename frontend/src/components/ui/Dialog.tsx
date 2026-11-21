import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { IconButton } from './Button'
import { scaleIn } from '../../lib/motion'

export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  labelledBy,
  dismissible = true,
  maxWidth = 'max-w-md',
}: {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  footer?: ReactNode
  labelledBy?: string
  dismissible?: boolean
  maxWidth?: string
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && dismissible) onClose()
    }
    document.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [open, onClose, dismissible])

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div
            className="absolute inset-0 bg-space-950/70 backdrop-blur-sm"
            onClick={dismissible ? onClose : undefined}
            aria-hidden="true"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            aria-labelledby={labelledBy}
            variants={scaleIn}
            initial="initial"
            animate="animate"
            exit="exit"
            className={`surface relative z-10 flex max-h-[92dvh] w-full ${maxWidth} flex-col overflow-hidden`}
          >
            <div className="flex items-start justify-between gap-4 px-6 pt-5">
              {title ? (
                <h2 id={labelledBy} className="text-xl font-semibold text-cream">
                  {title}
                </h2>
              ) : (
                <span />
              )}
              {dismissible && (
                <IconButton name="close" label="Close dialog" onClick={onClose} size="sm" />
              )}
            </div>
            <div className="scroll-thin flex-1 overflow-y-auto px-6 py-4">{children}</div>
            {footer && <div className="px-6 pb-6 pt-1">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
