import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

export interface DropdownItem {
  key: string
  label: string
  icon?: ReactNode
  onSelect?: () => void
  disabled?: boolean
  danger?: boolean
  /** Renders a small right-aligned hint (e.g. shortcut). */
  hint?: string
}

/** A self-contained dropdown menu with outside-click and Escape handling. */
export function Dropdown({
  trigger,
  items,
  align = 'end',
  children,
}: {
  trigger: (props: { open: boolean; toggle: () => void; ref: React.RefObject<HTMLButtonElement | null> }) => ReactNode
  items: DropdownItem[]
  align?: 'start' | 'end'
  children?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onPointer = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      {trigger({ open, toggle: () => setOpen((v) => !v), ref: buttonRef })}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className={`absolute z-40 mt-2 min-w-52 ${align === 'end' ? 'right-0' : 'left-0'}`}
          >
            <div className="surface-flat overflow-hidden p-1.5 shadow-panel">
              {children}
              {items.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  disabled={item.disabled}
                  onClick={() => {
                    setOpen(false)
                    item.onSelect?.()
                  }}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-colors ${
                    item.danger ? 'text-rose-300 hover:bg-rose-400/10' : 'text-cream hover:bg-white/8'
                  } ${item.disabled ? 'opacity-40' : ''}`}
                >
                  {item.icon && <span className="text-subtle">{item.icon}</span>}
                  <span className="flex-1">{item.label}</span>
                  {item.hint && <span className="text-xs text-subtle">{item.hint}</span>}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
