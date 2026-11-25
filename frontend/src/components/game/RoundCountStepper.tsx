import { Icon } from '../ui/Icon'

/** Shared round-count stepper used across singleplayer and multiplayer setup. */
export function RoundCountStepper({
  value,
  min,
  max,
  onChange,
  disabled = false,
}: {
  value: number
  min: number
  max: number
  onChange: (next: number) => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-center gap-3">
      <StepButton
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={disabled || value <= min}
        label="Fewer rounds"
        icon="minus"
      />
      <span
        aria-live="polite"
        className="min-w-8 text-center font-display text-2xl font-semibold tabular-nums text-cream"
      >
        {value}
      </span>
      <StepButton
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={disabled || value >= max}
        label="More rounds"
        icon="plus"
      />
    </div>
  )
}

function StepButton({
  onClick,
  disabled,
  label,
  icon,
}: {
  onClick: () => void
  disabled?: boolean
  label: string
  icon: 'plus' | 'minus'
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-11 items-center justify-center rounded-2xl border border-white/10 bg-space-600 text-cream transition-colors hover:bg-space-500 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-space-600"
    >
      <Icon name={icon} size={20} />
    </button>
  )
}
