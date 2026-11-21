import { motion } from 'framer-motion'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { staggerContainer, staggerItem } from '../../lib/motion'

export interface ExitDialogError {
  action: 'end'
  message: string
}

/**
 * Exit confirmation for an in-progress expedition (R06: no Save & Exit / no
 * resume). Ending is permanent — the active session is finalized server-side
 * and can never be continued again — so this always asks first rather than
 * abandoning silently.
 */
export function ExitGameDialog({
  onContinue,
  onEnd,
  pending,
  waiting = false,
  error,
  round,
  score,
}: {
  onContinue: () => void
  onEnd: () => void
  pending: 'end' | null
  waiting?: boolean
  error: ExitDialogError | null
  round: number
  score: number
}) {
  const busy = pending !== null
  return (
    <Modal title="End your adventure?" onClose={onContinue} closeDisabled={busy}>
      <motion.div variants={staggerContainer} initial="initial" animate="animate">
        <motion.p variants={staggerItem}>
          Your current game will end. You won&apos;t be able to continue this
          session afterward.
        </motion.p>
        <motion.p className="sp-exit-recap" variants={staggerItem}>
          Round {round} · {score.toLocaleString('en-US')} pts
        </motion.p>
        {error && (
          <motion.p className="tg-dialog-error" role="alert" variants={staggerItem}>
            {error.message}
          </motion.p>
        )}
        <motion.div className="tg-dialog-menu" variants={staggerItem}>
          <Button
            type="button"
            onClick={onContinue}
            disabled={busy}
            autoFocus
          >
            Keep Playing
          </Button>
          <Button variant="danger"
            type="button"
            onClick={onEnd}
            disabled={busy || waiting}
          >
            {pending === 'end' ? 'Ending…' : 'End Game'}
          </Button>
        </motion.div>
      </motion.div>
    </Modal>
  )
}
