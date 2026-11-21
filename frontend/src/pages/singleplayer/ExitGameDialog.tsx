import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'

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
      <p>
        Your current game will end. You won&apos;t be able to continue this
        session afterward.
      </p>
      <p className="sp-exit-recap">
        Round {round} · {score.toLocaleString('en-US')} pts
      </p>
      {error && (
        <p className="tg-dialog-error" role="alert">
          {error.message}
        </p>
      )}
      <div className="tg-dialog-menu">
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
      </div>
    </Modal>
  )
}
