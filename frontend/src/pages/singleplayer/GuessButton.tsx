import { GameIcon } from './GameplayHUD'

export function GuessButton({ disabled, busy = false, onClick }: {
  disabled: boolean
  busy?: boolean
  onClick: () => void
}) {
  return (
    <button className="sp-primary tg-control tg-control--primary sp-guess-button"
      aria-label="Guess" disabled={disabled} onClick={onClick}>
      <GameIcon name="pin" />{busy ? 'Submitting…' : 'Guess'}
      <kbd aria-hidden="true">↵</kbd>
    </button>
  )
}
