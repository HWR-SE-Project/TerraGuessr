import { Button } from '../components/ui/Button'
import { Icon } from '../components/ui/Icon'
import { AnimatePresence, motion } from 'framer-motion'
import { duration, ease } from '../lib/motion'
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
  const currentLabel = busy ? 'Submitting…' : label
  return <Button variant={variant} appearance={flat ? 'flat' : 'glass'}
    className={`sp-guess-button${flat ? ' tg-guess-submit' : ''}${compact ? ' tg-city-submit' : ''}${appearance === 'map' ? ' sp-map-submit' : ''}`}
    aria-label={variant === 'primary' ? 'Guess' : label} disabled={disabled} onClick={onClick}>
    <Icon name="pin" />
    <span className="sp-guess-button-label" style={{ position: 'relative', display: 'inline-grid' }}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={currentLabel}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0, transition: { duration: duration.fast, ease: ease.out } }}
          exit={{ opacity: 0, y: -6, transition: { duration: duration.instant, ease: ease.out } }}
          style={{ gridArea: '1 / 1' }}
        >
          {currentLabel}
        </motion.span>
      </AnimatePresence>
    </span>
    <kbd aria-hidden="true">↵</kbd>
  </Button>
}
