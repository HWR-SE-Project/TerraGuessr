import { GameDialog } from './GameDialog'

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
    <GameDialog title="End your adventure?" onClose={onContinue} closeDisabled={busy}>
      <p className="sp-muted">
        Your current game will end. You won&apos;t be able to continue this
        session afterward.
      </p>
      <p className="sp-exit-recap">
        Round {round} · {score.toLocaleString('en-US')} pts
      </p>
      {error && (
        <p className="sp-dialog-error" role="alert">
          {error.message}
        </p>
      )}
      <div className="sp-menu-actions">
        <button
          type="button"
          className="sp-primary tg-control tg-control--primary"
          onClick={onContinue}
          disabled={busy}
          autoFocus
        >
          Keep Playing
        </button>
        <button
          type="button"
          className="sp-secondary tg-control tg-control--danger"
          onClick={onEnd}
          disabled={busy || waiting}
        >
          {pending === 'end' ? 'Ending…' : 'End Game'}
        </button>
      </div>
    </GameDialog>
  )
}
