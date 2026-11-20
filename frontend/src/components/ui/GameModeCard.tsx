import { Link } from 'react-router-dom'
import { HomeIcon } from '../../pages/home/HomeIcon'
import type { HomeIconName } from '../../pages/home/HomeIcon'
import './GameModeCard.css'

/** A single, accessible game entry point with shared glass and tactile states. */
export function GameModeCard({
  to,
  icon,
  title,
  subtitle,
  primary = false,
}: {
  to: string
  icon: HomeIconName
  title: string
  subtitle: string
  primary?: boolean
}) {
  return (
    <Link
      to={to}
      className={`tg-mode-card tg-control${primary ? ' tg-mode-card--primary tg-control--primary' : ''}`}
    >
      <span className="tg-mode-card__icon"><HomeIcon name={icon} /></span>
      <span className="tg-mode-card__copy">
        <strong>{title}</strong>
        <small>{subtitle}</small>
      </span>
      <span className="tg-mode-card__arrow" aria-hidden="true"><HomeIcon name="arrow" /></span>
    </Link>
  )
}
