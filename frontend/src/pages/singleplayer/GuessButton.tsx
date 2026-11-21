import { GameIcon } from './GameplayHUD'

export function GuessButton({
  disabled,
  busy = false,
  onClick,
  label = 'Submit guess',
  variant = 'primary',
  compact = false,
  appearance = 'default',
}: {
  disabled: boolean
  busy?: boolean
  onClick: () => void
  label?: string
  variant?: 'primary' | 'secondary'
  compact?: boolean
  appearance?: 'default' | 'map'
}) {
  return (
    <button
      className={appearance === 'map'
        ? `sp-guess-button sp-map-submit${variant === 'secondary' ? ' sp-map-submit--secondary' : ''}`
        : compact
        ? `tg-city-submit${variant === 'secondary' ? ' tg-city-submit--secondary' : ''}`
        : `${variant === 'primary' ? 'sp-primary tg-control tg-control--primary' : 'sp-secondary tg-control'} sp-guess-button`}
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
