import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useSession } from '../../state/SessionContext'
import { Brand } from '../../components/ui/Brand'
import character from '../../assets/home/official/explorer.webp'
import './HomePage.css'
import { HomeIcon } from './HomeIcon'
import type { HomeIconName } from './HomeIcon'
import { Home3DScene } from './scene/Home3DScene'

type ShowNotice = (message: string) => void

function UnavailableButton({
  children,
  message,
  showNotice,
  className = '',
  label,
}: {
  children: ReactNode
  message: string
  showNotice: ShowNotice
  className?: string
  label?: string
}) {
  return (
    <button
      type="button"
      className={className}
      aria-label={label}
      aria-haspopup="dialog"
      title={message}
      onClick={() => showNotice(message)}
    >
      {children}
    </button>
  )
}

export function HomeNavigation({
  showNotice,
  active = 'singleplayer',
  showPlayerTools = false,
}: {
  showNotice: ShowNotice
  active?: 'singleplayer' | 'multiplayer' | 'none'
  showPlayerTools?: boolean
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const { user } = useSession()
  const { pathname } = useLocation()
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
          className={`th-nav-item${pathname === '/daily' ? ' th-nav-active' : ''}`}
          aria-current={pathname === '/daily' ? 'page' : undefined}
          onClick={() => setMenuOpen(false)}
        >
          <HomeIcon name="calendar" />
          Daily challenge
        </Link>
      </nav>
      {showPlayerTools && (
        <div className="th-player-tools">
          <UnavailableButton
            className="th-search"
            label="Search"
            message="Player and map search is not available yet."
            showNotice={showNotice}
          >
            <HomeIcon name="search" />
          </UnavailableButton>
          <Link
            to={user ? '/settings' : '/auth'}
            className="th-profile-link"
            aria-label={user ? 'Settings' : 'Sign in'}
          >
            <span className="th-profile-avatar" aria-hidden="true">
              {(user?.displayName ?? 'Explorer').slice(0, 1).toUpperCase()}
            </span>
            <span className="th-profile-details">
              <span className="th-profile-name">
                {user?.displayName ?? 'Guest explorer'}
              </span>
              <span className="th-profile-caption">
                {user ? 'Your account' : 'Sign in to save progress'}
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
  )
}

function HeroSection({ showNotice }: { showNotice: ShowNotice }) {
  return (
    <main className="th-hero" id="home-main" tabIndex={-1}>
      <div className="th-hero-copy">
        <p className="th-eyebrow">CURIOSITY HAS NO BORDERS</p>
        <h1>
          Explore the <span>World</span>
        </h1>
        <p className="th-description">
          Somewhere incredible. No idea where.
          <br className="th-desktop-break" /> Follow the clues. Find your place
          in the world.
        </p>
      </div>
      <div className="th-avatar-display">
        <img
          src={character}
          className="th-character"
          alt="Your explorer, ready for the next discovery"
          width="512"
          height="768"
          fetchPriority="high"
        />
        <UnavailableButton
          className="th-edit-avatar"
          message="Avatar customization is not available yet."
          showNotice={showNotice}
        >
          <HomeIcon name="pencil" />
          Edit Avatar
        </UnavailableButton>
      </div>
    </main>
  )
}

function GameModeCard({
  to,
  icon,
  title,
  subtitle,
  active = false,
}: {
  to: string
  icon: HomeIconName
  title: string
  subtitle: string
  active?: boolean
}) {
  return (
    <Link
      to={to}
      className={`th-mode th-glass${active ? ' th-mode-active' : ''}`}
    >
      <span className="th-mode-icon">
        <HomeIcon name={icon} />
      </span>
      <span className="th-mode-copy">
        <strong>{title}</strong>
        <small>{subtitle}</small>
      </span>
      <span className="th-mode-arrow" aria-hidden="true">
        ↗
      </span>
    </Link>
  )
}

export function AvailabilityNotice({
  message,
  onClose,
}: {
  message: string
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    ref.current?.showModal()
  }, [])
  const close = () => ref.current?.close()
  return (
    <dialog
      ref={ref}
      className="th-notice"
      aria-labelledby="th-notice-title"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) close()
      }}
    >
      <button
        className="th-notice-close"
        type="button"
        aria-label="Close notice"
        onClick={close}
      >
        <HomeIcon name="close" />
      </button>
      <h2 id="th-notice-title">Not available yet</h2>
      <p>{message}</p>
      <button
        type="button"
        className="th-notice-action"
        onClick={close}
        autoFocus
      >
        Got it
      </button>
    </dialog>
  )
}

export function HomeExperience() {
  const [notice, setNotice] = useState<string | null>(null)
  return (
    <div className="th-home">
      <a className="th-skip" href="#home-main">
        Skip to content
      </a>
      <Home3DScene />
      <div className="th-orbit th-orbit-one" aria-hidden="true" />
      <div className="th-orbit th-orbit-two" aria-hidden="true" />
      <HomeNavigation showNotice={setNotice} showPlayerTools />
      <HeroSection showNotice={setNotice} />
      <div className="th-world-note" aria-hidden="true">
        <span>ONE PLANET.</span>
        <span>ENDLESS PERSPECTIVES.</span>
      </div>
      <nav className="th-game-modes" aria-label="Game modes">
        <GameModeCard
          to="/game/singleplayer"
          icon="play"
          title="Play Solo"
          subtitle="Challenge yourself"
          active
        />
        <GameModeCard
          to="/duels"
          icon="users"
          title="Play Together"
          subtitle="With friends"
        />
        <GameModeCard
          to="/duels"
          icon="rank"
          title="Compete"
          subtitle="Climb the leaderboards"
        />
      </nav>
      <footer className="th-footer">
        <span>A little curiosity goes a long way.</span>
        <span className="th-footer-links">
          <a href="/asset-credits.txt" target="_blank" rel="noreferrer">
            Earth credits
          </a>
          <Link to="/play">
            Try the weather expedition <span aria-hidden="true">↗</span>
          </Link>
        </span>
      </footer>
      {notice && (
        <AvailabilityNotice message={notice} onClose={() => setNotice(null)} />
      )}
    </div>
  )
}
