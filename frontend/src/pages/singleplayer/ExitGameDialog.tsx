import { GameDialog } from './GameDialog'

export interface ExitDialogError {
  action: 'save' | 'leave'
  message: string
}

/**
 * Exit confirmation for an in-progress expedition. Every round/guess is
 * already persisted server-side as it happens — "Save & Exit" confirms the
 * session is still reachable before the player walks away believing that;
 * "Leave Game" explicitly abandons it instead of just hoping they come back.
 */
export function ExitGameDialog({
  onContinue,
  onSaveExit,
  onLeave,
  pending,
  error,
  round,
  roundsTotal,
  score,
}: {
  onContinue: () => void
  onSaveExit: () => void
  onLeave: () => void
  pending: 'save' | 'leave' | null
  error: ExitDialogError | null
  round: number
  roundsTotal: number
  score: number
}) {
  const busy = pending !== null
  return (
    <GameDialog title="Leave this game?" onClose={onContinue}>
      <p className="sp-muted">
        You have a game in progress. Would you like to save your progress
        and continue later, or leave this game?
      </p>
      <p className="sp-exit-recap">
        Round {round} of {roundsTotal} · {score.toLocaleString('en-US')} pts
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
          Continue Playing
        </button>
        <button
          type="button"
          className="sp-secondary tg-control"
          onClick={onSaveExit}
          disabled={busy}
        >
          {pending === 'save' ? 'Saving…' : 'Save & Exit'}
        </button>
        <button
          type="button"
          className="sp-secondary tg-control tg-control--danger"
          onClick={onLeave}
          disabled={busy}
        >
          {pending === 'leave' ? 'Leaving…' : 'Leave Game'}
        </button>
      </div>
      <p className="sp-dialog-hint">
        Saved automatically and resumable from this browser for up to 24
        hours. Closing this tab ends your ability to resume it.
      </p>
    </GameDialog>
  )
}
