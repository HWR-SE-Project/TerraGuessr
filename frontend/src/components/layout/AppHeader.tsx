import { Icon } from '../ui/Icon'
import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useSession } from '../../state/SessionContext'
import { IconButton } from '../ui/IconButton'
import { MultiplayerMenu } from './MultiplayerMenu'
import './AppHeader.css'

const destinations = [
  { to: '/game/singleplayer', label: 'Singleplayer' },
] as const

/** Shared header for discovery pages, account flows and game lifecycle screens. */
export function AppHeader({ game = false, summary = false, onHelp, onSettings, onMenu, children }: {
  game?: boolean
  summary?: boolean
  onHelp?: () => void
  onSettings?: () => void
  onMenu?: () => void
  children?: ReactNode
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const { user } = useSession()
  const location = useLocation()
  const headerRef = useRef<HTMLElement>(null)
  const menuRef = useRef<HTMLButtonElement>(null)
  // Close disclosure after routing, including browser Back.
  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => { setMenuOpen(false) }, [location])
  useEffect(() => {
    if (!menuOpen) return
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        event.preventDefault()
        setMenuOpen(false)
        menuRef.current?.focus()
      }
    }
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !headerRef.current?.contains(event.target)) setMenuOpen(false)
    }
    window.addEventListener('keydown', escape)
    window.addEventListener('pointerdown', outside)
    return () => {
      window.removeEventListener('keydown', escape)
      window.removeEventListener('pointerdown', outside)
    }
  }, [menuOpen])
  const help = onHelp
    ? <IconButton className="th-icon-btn" title="How to play" aria-label="How to play" onClick={() => { setMenuOpen(false); onHelp() }} data-tutorial-trigger><Icon name="help" /><span className="th-icon-btn-label">How to play</span></IconButton>
    : <Link to="/game/singleplayer?tutorial=1" className="th-icon-btn tg-control tg-icon-button th-tutorial-entry" title="Help" aria-label="Help" onClick={() => setMenuOpen(false)}><Icon name="help" /><span className="th-icon-btn-label">Help</span></Link>
  const settings = onSettings
    ? <IconButton className="th-icon-btn" title="Game settings" aria-label="Game settings" onClick={() => { setMenuOpen(false); onSettings() }}><Icon name="gear" /><span className="th-icon-btn-label">Game settings</span></IconButton>
    : <Link to="/settings" className="th-icon-btn tg-control tg-icon-button" title="Settings" aria-label="Settings" onClick={() => setMenuOpen(false)}><Icon name="gear" /><span className="th-icon-btn-label">Settings</span></Link>
  return <div className="tg-page-nav" data-navigation-context={game ? 'game' : 'page'}>
    <header ref={headerRef} className="th-header">
      <Link to="/" className="th-brand" aria-label="TerraGuessr home"><span className="tg-brand">
      <span className="tg-brand-mark" aria-hidden="true">
        <svg viewBox="0 0 32 32" fill="none">
          <path
            d="M16 3 27 9v14l-11 6L5 23V9Z"
            stroke="currentColor"
            strokeWidth="1.3"
          />
          <path
            d="M10 11h12M16 11v11"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <circle cx="24" cy="7" r="3" fill="currentColor" />
        </svg>
      </span>
      <span className="tg-brand-word">
        Terra<span>Guessr</span>
        <span className="tg-brand-period">.</span>
      </span>
    </span></Link>
      {!game && <nav id="main-navigation" className={`th-navigation${menuOpen ? ' th-navigation-open' : ''}`} aria-label="Main navigation">
        {destinations.map(({ to, label }) => <Link key={to} to={to} className="th-nav-link"
          aria-current={location.pathname === to ? 'page' : undefined}
          onClick={() => setMenuOpen(false)}>{label}</Link>)}
        <MultiplayerMenu mobileMenuOpen={menuOpen} onNavigate={() => setMenuOpen(false)} />
        {!summary && <div className="th-mobile-utilities">{help}{(!user || onSettings) && settings}</div>}
      </nav>}
      <div className="th-player-tools">
        {!summary && <div className="th-desktop-utilities">{help}{(onSettings || !user) && settings}</div>}
        {children}
        {!game && (<Link to={user ? '/settings' : '/auth'} className="th-profile-link" aria-label={user ? 'Settings' : 'Sign in'}>
          <span className="th-profile-avatar" aria-hidden="true">{user ? user.displayName.slice(0, 1).toUpperCase() : 'G'}</span>
          <span className="th-profile-details"><span className="th-profile-name">{user?.displayName ?? 'Sign in'}</span></span>
        </Link>)}
        {game && onMenu && <IconButton className="th-icon-btn" aria-label="Game menu" title="Game menu" onClick={onMenu}><Icon name="menu" /></IconButton>}
      </div>
      {!game && <IconButton ref={menuRef} className="th-icon-btn th-menu-toggle" type="button"
        aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={menuOpen} aria-controls="main-navigation"
        onClick={() => setMenuOpen(!menuOpen)}><Icon name={menuOpen ? 'close' : 'menu'} /></IconButton>}
    </header>
  </div>
}
