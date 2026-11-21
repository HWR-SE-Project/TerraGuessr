import './Spinner.css'

export function Spinner({
  label = 'Loading…',
  className = '',
}: {
  label?: string
  className?: string
}) {
  return (
    <span className={`tg-spinner ${className}`} role="status" aria-label={label}>
      <span className="tg-spinner__ring" aria-hidden="true" />
    </span>
  )
}
