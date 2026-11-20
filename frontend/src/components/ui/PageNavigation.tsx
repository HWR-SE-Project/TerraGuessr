import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useSession } from '../../state/SessionContext'
import { Brand } from './Brand'
import { HomeIcon } from '../../pages/home/HomeIcon'
import './PageNavigation.css'

export type NavActiveKey = 'singleplayer' | 'multiplayer' | 'daily' | 'none'
const destinations = [
  { key: 'singleplayer', to: '/game/singleplayer', label: 'Singleplayer', icon: 'gamepad' },
  { key: 'multiplayer', to: '/multiplayer', label: 'Multiplayer', icon: 'users' },
  { key: 'duels', to: '/duels', label: 'Duels', icon: 'trophy' },
] as const

export function AppNavigation({ active, onNavigate }: { active: NavActiveKey; onNavigate?: () => void }) {
  const { pathname } = useLocation()
  return <>{destinations.map(item => <Link key={item.key} to={item.to}
    className="th-nav-item tg-control tg-nav-pill"
    aria-current={(item.key === 'duels' ? pathname === '/duels' : item.key === active && pathname !== '/duels') ? 'page' : undefined}
    onClick={onNavigate}><HomeIcon name={item.icon} />{item.label}</Link>)}</>
}

/** Shared header for discovery pages, account flows and game lifecycle screens. */
export function PageNavigation({ active, authActions, game = false, summary = false, onHelp, onSettings, onMenu, children }: {
  active: NavActiveKey
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
      if (event.key === 'Escape') {
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
    ? <button className="th-nav-item tg-control tg-action" onClick={() => { setMenuOpen(false); onHelp() }} data-tutorial-trigger><HomeIcon name="info" />How to play</button>
    : <Link to="/game/singleplayer?tutorial=1" className="th-nav-item th-tutorial-entry tg-control tg-action" onClick={() => setMenuOpen(false)}><HomeIcon name="info" />How to Play / Tutorial</Link>
  const settings = onSettings
    ? <button className="th-nav-item tg-control tg-action" aria-label="Game settings" onClick={() => { setMenuOpen(false); onSettings() }}>Settings</button>
    : <Link to="/settings" className="th-nav-item tg-control tg-action" onClick={() => setMenuOpen(false)}>Settings</Link>
  return <div className="tg-page-nav" data-navigation-context={game ? 'game' : 'page'}>
    <header ref={headerRef} className="th-header">
      <Link to="/" className="th-brand" aria-label="TerraGuessr home"><Brand /></Link>
      <nav id="main-navigation" className={`th-navigation${menuOpen ? ' th-navigation-open' : ''}`} aria-label="Main navigation">
        <AppNavigation active={active} onNavigate={() => setMenuOpen(false)} />
        {!summary && <div className="th-mobile-utilities">{help}{(!user || onSettings) && settings}{authActions && <div className="th-auth-actions" onClick={() => setMenuOpen(false)}>{authActions}</div>}</div>}
      </nav>
      <div className="th-player-tools">
        {!summary && <div className="th-desktop-utilities">{help}{(onSettings || !user) && settings}</div>}
        {children}
        {!game && (authActions ? <div className="th-desktop-utilities">{authActions}</div> : <Link to={user ? '/settings' : '/auth'} className="th-profile-link tg-control" aria-label={user ? 'Settings' : 'Sign in'}>
          <span className="th-profile-avatar" aria-hidden="true">{user ? user.displayName.slice(0, 1).toUpperCase() : 'G'}</span>
          <span className="th-profile-details"><span className="th-profile-name">{user?.displayName ?? 'Sign in'}</span></span>
        </Link>)}
        {game && onMenu && <button className="tg-control tg-icon-button th-game-menu" aria-label="Game menu" title="Game menu" onClick={onMenu}><HomeIcon name="menu" /></button>}
      </div>
      {!game && <button ref={menuRef} className="th-menu-button tg-control tg-icon-button" type="button"
        aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={menuOpen} aria-controls="main-navigation"
        onClick={() => setMenuOpen(!menuOpen)}><HomeIcon name={menuOpen ? 'close' : 'menu'} /></button>}
    </header>
  </div>
}
