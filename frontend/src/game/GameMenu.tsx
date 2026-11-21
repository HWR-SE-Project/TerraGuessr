import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Modal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'
import { duration, ease } from '../lib/motion'

/** Game controls remain reachable through the header menu on narrow screens. */
export function GameMenu({ title = 'Menu', onClose, onHelp, onSettings, children }: {
  title?: string
  onClose: () => void
  onHelp?: () => void
  onSettings?: () => void
  children: ReactNode
}) {
  return <Modal title={title} onClose={onClose}>
    <motion.div
      className="tg-dialog-menu"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: duration.base, ease: ease.out }}
    >
      <Button onClick={onClose}>Back to game <span className="sp-primary-arrow">→</span></Button>
      {onHelp && <Button variant="secondary" onClick={onHelp}>How to play</Button>}
      {onSettings && <Button variant="secondary" onClick={onSettings}>Game settings</Button>}
      {children}
    </motion.div>
  </Modal>
}
