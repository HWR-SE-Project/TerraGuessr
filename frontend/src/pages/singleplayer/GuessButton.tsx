import { GameIcon } from './GameplayHUD'

export function GuessButton({
  disabled,
  busy = false,
  onClick,
  label = 'Submit guess',
  variant = 'primary',
}: {
  disabled: boolean
  busy?: boolean
  onClick: () => void
  label?: string
  variant?: 'primary' | 'secondary'
}) {
  return (
    <button
      className={`${variant === 'primary' ? 'sp-primary tg-control tg-control--primary' : 'sp-secondary tg-control'} sp-guess-button`}
      aria-label={variant === 'primary' ? 'Guess' : label}
      disabled={disabled}
      onClick={onClick}
    >
      <GameIcon name="pin" />
      {busy ? 'Submitting…' : label}
      <kbd aria-hidden="true">↵</kbd>
    </button>
  )
}
