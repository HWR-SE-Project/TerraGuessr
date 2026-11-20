import { GameIcon } from './GameplayHUD'

/** Shared visual control; the caller owns whether this confirms practice or a real round. */
export function GuessButton({ disabled, busy = false, onClick, practice = false }: {
  disabled: boolean
  busy?: boolean
  onClick: () => void
  practice?: boolean
}) {
  return (
    <button className="sp-primary tg-control tg-control--primary sp-guess-button"
      aria-label={practice ? 'Confirm practice guess' : 'Guess'} disabled={disabled} onClick={onClick}>
      <GameIcon name="pin" />{busy ? 'Submitting…' : 'Guess'}
      {practice ? <small>Practice only</small> : <kbd aria-hidden="true">↵</kbd>}
    </button>
  )
}
