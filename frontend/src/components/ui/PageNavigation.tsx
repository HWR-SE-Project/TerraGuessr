import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useSession } from '../../state/SessionContext'
import { Brand } from './Brand'
import { HomeIcon } from '../../pages/home/HomeIcon'
import { MultiplayerMenu } from './MultiplayerMenu'
import './PageNavigation.css'

const destinations = [
  { to: '/game/singleplayer', label: 'Singleplayer' },
] as const

/** Shared header for discovery pages, account flows and game lifecycle screens. */
export function PageNavigation({ authActions, game = false, summary = false, onHelp, onSettings, onMenu, children }: {
  authActions?: ReactNode
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
    ? <button type="button" className="th-icon-btn" title="How to play" aria-label="How to play" onClick={() => { setMenuOpen(false); onHelp() }} data-tutorial-trigger><HomeIcon name="help" /><span className="th-icon-btn-label">How to play</span></button>
    : <Link to="/game/singleplayer?tutorial=1" className="th-icon-btn th-tutorial-entry" title="Help" aria-label="Help" onClick={() => setMenuOpen(false)}><HomeIcon name="help" /><span className="th-icon-btn-label">Help</span></Link>
  const settings = onSettings
    ? <button type="button" className="th-icon-btn" title="Game settings" aria-label="Game settings" onClick={() => { setMenuOpen(false); onSettings() }}><HomeIcon name="gear" /><span className="th-icon-btn-label">Game settings</span></button>
    : <Link to="/settings" className="th-icon-btn" title="Settings" aria-label="Settings" onClick={() => setMenuOpen(false)}><HomeIcon name="gear" /><span className="th-icon-btn-label">Settings</span></Link>
  return <div className="tg-page-nav" data-navigation-context={game ? 'game' : 'page'}>
    <header ref={headerRef} className="th-header">
      <Link to="/" className="th-brand" aria-label="TerraGuessr home"><Brand /></Link>
      {!game && <nav id="main-navigation" className={`th-navigation${menuOpen ? ' th-navigation-open' : ''}`} aria-label="Main navigation">
        {destinations.map(({ to, label }) => <Link key={to} to={to} className="th-nav-link"
          aria-current={location.pathname === to ? 'page' : undefined}
          onClick={() => setMenuOpen(false)}>{label}</Link>)}
        <MultiplayerMenu mobileMenuOpen={menuOpen} onNavigate={() => setMenuOpen(false)} />
        {!summary && <div className="th-mobile-utilities">{help}{(!user || onSettings) && settings}{authActions && <div className="th-auth-actions" onClick={() => setMenuOpen(false)}>{authActions}</div>}</div>}
      </nav>}
      <div className="th-player-tools">
        {!summary && <div className="th-desktop-utilities">{help}{(onSettings || !user) && settings}</div>}
        {children}
        {!game && (authActions ? <div className="th-desktop-utilities">{authActions}</div> : <Link to={user ? '/settings' : '/auth'} className="th-profile-link" aria-label={user ? 'Settings' : 'Sign in'}>
          <span className="th-profile-avatar" aria-hidden="true">{user ? user.displayName.slice(0, 1).toUpperCase() : 'G'}</span>
          <span className="th-profile-details"><span className="th-profile-name">{user?.displayName ?? 'Sign in'}</span></span>
        </Link>)}
        {game && onMenu && <button type="button" className="th-icon-btn" aria-label="Game menu" title="Game menu" onClick={onMenu}><HomeIcon name="menu" /></button>}
      </div>
      {!game && <button ref={menuRef} className="th-icon-btn th-menu-toggle" type="button"
        aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={menuOpen} aria-controls="main-navigation"
        onClick={() => setMenuOpen(!menuOpen)}><HomeIcon name={menuOpen ? 'close' : 'menu'} /></button>}
    </header>
  </div>
}
