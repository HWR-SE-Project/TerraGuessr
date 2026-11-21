import { Button } from '../components/ui/Button'
import { Icon } from '../components/ui/Icon'
import './GuessButton.css'

export function GuessButton({ disabled, busy = false, onClick, label = 'Submit guess', variant = 'primary', compact = false, appearance = 'default' }: {
  disabled: boolean
  busy?: boolean
  onClick: () => void
  label?: string
  variant?: 'primary' | 'secondary'
  compact?: boolean
  appearance?: 'default' | 'map'
}) {
  const flat = compact || appearance === 'map'
  return <Button variant={variant} appearance={flat ? 'flat' : 'glass'}
    className={`sp-guess-button${flat ? ' tg-guess-submit' : ''}${compact ? ' tg-city-submit' : ''}${appearance === 'map' ? ' sp-map-submit' : ''}`}
    aria-label={variant === 'primary' ? 'Guess' : label} disabled={disabled} onClick={onClick}>
    <Icon name="pin" />{busy ? 'Submitting…' : label}<kbd aria-hidden="true">↵</kbd>
  </Button>
}
