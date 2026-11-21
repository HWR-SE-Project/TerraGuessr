import type { ReactNode } from 'react'
import { Modal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'

/** Game controls remain reachable through the header menu on narrow screens. */
export function GameMenu({ title = 'Menu', onClose, onHelp, onSettings, children }: {
  title?: string
  onClose: () => void
  onHelp: () => void
  onSettings: () => void
  children: ReactNode
}) {
  return <Modal title={title} onClose={onClose}>
    <div className="tg-dialog-menu">
      <Button onClick={onClose}>Back to game <span className="sp-primary-arrow">→</span></Button>
      <Button variant="secondary" onClick={onHelp}>How to play</Button>
      <Button variant="secondary" onClick={onSettings}>Game settings</Button>
      {children}
    </div>
  </Modal>
}
