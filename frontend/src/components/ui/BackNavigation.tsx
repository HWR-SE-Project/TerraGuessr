import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import './PageNavigation.css'

/** Use an explicit destination so direct entry and browser history behave alike. */
export function BackNavigation({ to, children = 'Back' }: { to: string; children?: ReactNode }) {
  return <Link to={to} className="tg-back-navigation tg-control tg-action">{children}</Link>
}
