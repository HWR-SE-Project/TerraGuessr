import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSession } from '../../state/SessionContext'
import { Brand } from './Brand'
import { HomeIcon } from '../../pages/home/HomeIcon'
import '../../pages/home/HomePage.css'

export type NavActiveKey = 'singleplayer' | 'multiplayer' | 'daily' | 'none'

/**
 * The one shared top-of-page navigation bar for every route. `active` is
 * required (not defaulted) so each page states its own identity explicitly
 * instead of inheriting whatever the last page happened to pick.
 *
 * `authActions`, when provided, replaces the signed-out player-tools slot
 * (profile chip / "Sign in" link) with page-specific controls. The Auth
 * landing page is the only user: it's already on /auth, so a "Sign in" link
 * back to /auth would be circular — it needs its own Login/Sign up buttons
 * that drive the embedded card instead of routing anywhere.
 */
export function PageNavigation({
  active,
  authActions,
}: {
  active: NavActiveKey
  authActions?: ReactNode
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const { user } = useSession()
  const headerRef = useRef<HTMLElement>(null)
  const menuRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!menuOpen) return
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false)
        menuRef.current?.focus()
      }
    }
    const outside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !headerRef.current?.contains(event.target)
      )
        setMenuOpen(false)
    }
    window.addEventListener('keydown', escape)
    window.addEventListener('pointerdown', outside)
    return () => {
      window.removeEventListener('keydown', escape)
      window.removeEventListener('pointerdown', outside)
    }
  }, [menuOpen])
  return (
    <div className="tg-page-nav">
      <header ref={headerRef} className="th-header">
        <Link to="/" className="th-brand" aria-label="TerraGuessr home">
          <Brand />
        </Link>
        <nav
          id="main-navigation"
          className={`th-navigation${menuOpen ? ' th-navigation-open' : ''}`}
          aria-label="Main navigation"
        >
          <Link
            to="/game/singleplayer"
            className={`th-nav-item${active === 'singleplayer' ? ' th-nav-active' : ''}`}
            aria-current={active === 'singleplayer' ? 'page' : undefined}
            onClick={() => setMenuOpen(false)}
          >
            <HomeIcon name="gamepad" />
            Singleplayer
          </Link>
          <Link
            to="/duels"
            className={`th-nav-item${active === 'multiplayer' ? ' th-nav-active' : ''}`}
            aria-current={active === 'multiplayer' ? 'page' : undefined}
            onClick={() => setMenuOpen(false)}
          >
            <HomeIcon name="users" />
            Multiplayer
          </Link>
          <Link
            to="/daily"
            className={`th-nav-item${active === 'daily' ? ' th-nav-active' : ''}`}
            aria-current={active === 'daily' ? 'page' : undefined}
            onClick={() => setMenuOpen(false)}
          >
            <HomeIcon name="calendar" />
            Daily challenge
          </Link>
        </nav>
        {user ? (
          <div className="th-player-tools">
            <Link
              to="/settings"
              className="th-profile-link"
              aria-label="Settings"
            >
              <span className="th-profile-avatar" aria-hidden="true">
                {(user.displayName ?? 'Explorer').slice(0, 1).toUpperCase()}
              </span>
              <span className="th-profile-details">
                <span className="th-profile-name">{user.displayName}</span>
                <span className="th-profile-caption">Your account</span>
              </span>
              <HomeIcon name="chevron" />
            </Link>
          </div>
        ) : authActions ? (
          <div className="th-player-tools th-player-tools-auth">
            {authActions}
          </div>
        ) : (
          <div className="th-player-tools">
            <Link to="/auth" className="th-profile-link" aria-label="Sign in">
              <span className="th-profile-avatar" aria-hidden="true">
                G
              </span>
              <span className="th-profile-details">
                <span className="th-profile-name">Guest explorer</span>
                <span className="th-profile-caption">
                  Sign in to save progress
                </span>
              </span>
              <HomeIcon name="chevron" />
            </Link>
          </div>
        )}
        <button
          ref={menuRef}
          className="th-menu-button"
          type="button"
          aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={menuOpen}
          aria-controls="main-navigation"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <HomeIcon name={menuOpen ? 'close' : 'menu'} />
        </button>
      </header>
    </div>
  )
}
