import { Link } from 'react-router-dom'
import { Icon } from './Icon'

/** TerraGuessr brand mark: a lime globe with a friendly pin. */
export function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <span
      className="relative inline-flex items-center justify-center rounded-2xl bg-lime-400 text-ink shadow-card"
      style={{ width: size, height: size }}
    >
      <Icon name="globe" size={Math.round(size * 0.62)} />
      <span
        className="absolute -bottom-1 -right-1 flex items-center justify-center rounded-full bg-space-900 text-lime-300"
        style={{ width: size * 0.5, height: size * 0.5 }}
      >
        <Icon name="pin" size={Math.round(size * 0.32)} />
      </span>
    </span>
  )
}

export function Logo({ to = '/', withWord = true }: { to?: string; withWord?: boolean }) {
  return (
    <Link to={to} className="group inline-flex items-center gap-2.5" aria-label="TerraGuessr home">
      <LogoMark />
      {withWord && (
        <span className="font-display text-xl font-semibold tracking-tight text-cream">
          Terra<span className="text-lime-400">Guessr</span>
        </span>
      )}
    </Link>
  )
}
