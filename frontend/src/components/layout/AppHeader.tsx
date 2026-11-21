import { Icon } from '../ui/Icon'
import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useSession } from '../../state/SessionContext'
import { IconButton } from '../ui/IconButton'
import { MultiplayerMenu } from './MultiplayerMenu'
import { duration, ease, spring, staggerContainer, staggerItem, collapseVariants } from '../../lib/motion'
import './AppHeader.css'

const MotionLink = motion.create(Link)
const COMPACT_QUERY = '(max-width: 75rem)'

const destinations = [
  { to: '/game/singleplayer', label: 'Singleplayer' },
] as const

/** Shared header for discovery pages, account flows and game lifecycle screens. */
export function AppHeader({ game = false, summary = false, showHelp = true, onHelp, onSettings, onMenu, children }: {
  game?: boolean
  summary?: boolean
  showHelp?: boolean
  onHelp?: () => void
  onSettings?: () => void
  onMenu?: () => void
  children?: ReactNode
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [isCompact, setIsCompact] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia(COMPACT_QUERY).matches)
  const { user } = useSession()
  const location = useLocation()
  const navigate = useNavigate()
  const headerRef = useRef<HTMLElement>(null)
  const menuRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const query = window.matchMedia(COMPACT_QUERY)
    const handle = () => setIsCompact(query.matches)
    query.addEventListener('change', handle)
    return () => query.removeEventListener('change', handle)
  }, [])
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
  const help = !showHelp
    ? null
    : onHelp
      ? <IconButton className="th-icon-btn" title="How to play" aria-label="How to play" onClick={() => { setMenuOpen(false); onHelp() }}><Icon name="help" /><span className="th-icon-btn-label">How to play</span></IconButton>
      : <Link to="/how-to-play" className="th-icon-btn th-nav-action th-tutorial-entry" title="How to play" aria-label="How to play" aria-current={location.pathname === '/how-to-play' ? 'page' : undefined} onClick={() => setMenuOpen(false)}><Icon name="help" /><span className="th-icon-btn-label">How to play</span></Link>
  const settings = onSettings
    ? <IconButton className="th-icon-btn" title="Game settings" aria-label="Game settings" onClick={() => { setMenuOpen(false); onSettings() }}><Icon name="gear" /><span className="th-icon-btn-label">Game settings</span></IconButton>
    : location.pathname === '/settings'
      ? <IconButton className="th-icon-btn th-nav-action" title="Close settings" aria-label="Close settings" aria-pressed="true" onClick={() => { setMenuOpen(false); navigate('/') }}><Icon name="gear" /><span className="th-icon-btn-label">Settings</span></IconButton>
      : <Link to="/settings" className="th-icon-btn th-nav-action" title="Settings" aria-label="Settings" onClick={() => setMenuOpen(false)}><Icon name="gear" /><span className="th-icon-btn-label">Settings</span></Link>
  // Desktop nav is always visible (no entrance needed); plain Links avoid being
  // stuck at the staggerItem "initial" state with no animating ancestor.
  const navLinks = destinations.map(({ to, label }) => {
    const isActive = location.pathname === to
    return <Link key={to} to={to} className="th-nav-link"
      aria-current={isActive ? 'page' : undefined}
      onClick={() => setMenuOpen(false)}>
      {isActive && <motion.span className="th-nav-pill" layoutId="th-nav-pill" transition={spring.gentle} />}
      {label}
    </Link>
  })
  // Mobile drawer variant: same links, but staggered in via the shared motion primitives.
  const animatedNavLinks = destinations.map(({ to, label }) => {
    const isActive = location.pathname === to
    return <MotionLink key={to} to={to} className="th-nav-link" variants={staggerItem}
      aria-current={isActive ? 'page' : undefined}
      onClick={() => setMenuOpen(false)}>
      {isActive && <motion.span className="th-nav-pill" layoutId="th-nav-pill" transition={spring.gentle} />}
      {label}
    </MotionLink>
  })
  return <div className="tg-page-nav" data-navigation-context={game ? 'game' : 'page'}>
    <motion.header ref={headerRef} className="th-header"
      initial={{ opacity: 0, y: -18 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: duration.slow, ease: ease.emphasized }}>
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
      {!game && (isCompact
        ? <AnimatePresence initial={false}>
            {menuOpen && <motion.nav key="mobile-nav" id="main-navigation" className="th-navigation"
              aria-label="Main navigation" variants={collapseVariants} initial="initial" animate="animate" exit="exit">
              <motion.div className="th-navigation-stagger" variants={staggerContainer} initial="initial" animate="animate">
                {animatedNavLinks}
                <motion.div variants={staggerItem}><MultiplayerMenu mobileMenuOpen={menuOpen} onNavigate={() => setMenuOpen(false)} /></motion.div>
                {!summary && <motion.div variants={staggerItem} className="th-mobile-utilities">{help}{(!user || onSettings) && settings}</motion.div>}
              </motion.div>
            </motion.nav>}
          </AnimatePresence>
        : <nav id="main-navigation" className="th-navigation" aria-label="Main navigation">
            {navLinks}
            <MultiplayerMenu mobileMenuOpen={menuOpen} onNavigate={() => setMenuOpen(false)} />
            {!summary && <div className="th-mobile-utilities">{help}{(!user || onSettings) && settings}</div>}
          </nav>)}
      <div className="th-player-tools">
        {!summary && <div className="th-desktop-utilities">{help}{(onSettings || !user) && settings}</div>}
        {children}
        {!game && (<Link to={user ? '/settings' : '/auth'} className={`th-profile-link${user ? ' th-profile-link--account' : ' th-profile-link--signin'}`} aria-label={user ? 'Settings' : 'Sign in'}>
          <span className="th-profile-avatar" aria-hidden="true">{user ? user.displayName.slice(0, 1).toUpperCase() : 'G'}</span>
          <span className="th-profile-details"><span className="th-profile-name">{user?.displayName ?? 'Sign in'}</span></span>
        </Link>)}
        {game && onMenu && <IconButton className="th-icon-btn" aria-label="Game menu" title="Game menu" onClick={onMenu}><Icon name="menu" /></IconButton>}
      </div>
      {!game && <button ref={menuRef} className="th-icon-btn th-nav-action th-menu-toggle" type="button"
        aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={menuOpen} aria-controls="main-navigation"
        onClick={() => setMenuOpen(!menuOpen)}><Icon name={menuOpen ? 'close' : 'menu'} /></button>}
    </motion.header>
  </div>
}
