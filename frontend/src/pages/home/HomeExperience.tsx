import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useSession } from '../../state/SessionContext'
import character from '../../assets/home/official/explorer.webp'
import earth from '../../assets/home/official/earth-horizon.webp'
import defaultAvatar from '../../assets/home/official/alpine-lake.webp'
import sky from '../../assets/home/official/sky.svg'
import { HomeIcon } from './HomeIcon'
import type { HomeIconName } from './HomeIcon'

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
  active?: 'singleplayer' | 'multiplayer'
  showPlayerTools?: boolean
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const { user } = useSession()
  return (
    <header className="th-header">
      <Link to="/" className="th-brand" aria-label="TerraGuessr home">
        <span className="th-brand-mark">T</span>
        <span className="th-wordmark">
          Terra<span>Guessr</span>
        </span>
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
        <UnavailableButton
          className="th-nav-item"
          message="Party lobbies are not available yet. You can challenge a friend in Duels."
          showNotice={showNotice}
        >
          <HomeIcon name="bolt" />
          Party
        </UnavailableButton>
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
          <span className="th-profile-divider" aria-hidden="true" />
          <Link to="/settings" className="th-profile-link" aria-label="Settings">
            <span className="th-profile-avatar">
              <img src={defaultAvatar} alt="" width="50" height="50" />
            </span>
            <span className="th-profile-details">
              <span className="th-profile-name">{user?.displayName ?? 'Guest'}</span>
              <span className="th-currency" title="Currency is not available yet">
                <HomeIcon name="coin" />
                <span aria-label="Currency unavailable">—</span>
              </span>
            </span>
          </Link>
          <span className="th-profile-divider" aria-hidden="true" />
          <span
            className="th-level"
            aria-label="Explorer levels coming soon"
            title="Explorer levels coming soon"
          >
            —
          </span>
        </div>
      )}
      <button
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
        <p className="th-eyebrow">A GEOGRAPHY GUESSING GAME</p>
        <h1>
          Explore the{' '}
          <span>
            World
            <svg
              className="th-world-accent"
              viewBox="0 0 260 140"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M70 132Q145 122 211 130"
                stroke="currentColor"
                strokeWidth="6"
                strokeLinecap="round"
              />
              <path
                d="m218 29-1-15m20 18 8-14m6 29 18-8"
                stroke="currentColor"
                strokeWidth="6"
                strokeLinecap="round"
              />
            </svg>
          </span>
        </h1>
        <p className="th-description">
          Get dropped into a mystery spot with nothing but live<br className="th-desktop-break" />
          {' '}weather data to go on. How far off can your guess be?
        </p>
      </div>
      <div className="th-avatar-display">
        <img
          src={character}
          className="th-character"
          alt="TerraGuessr character with dark swept hair, a striped blue shirt and khaki trousers"
          width="200"
          height="300"
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
      <span>
        <strong>{title}</strong>
        <small>{subtitle}</small>
      </span>
    </Link>
  )
}

function AvailabilityNotice({
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
      <div className="th-earth" aria-hidden="true">
        <img src={earth} alt="" fetchPriority="high" />
      </div>
      <img className="th-sky" src={sky} alt="" aria-hidden="true" />
      <HomeNavigation showNotice={setNotice} showPlayerTools />
      <HeroSection showNotice={setNotice} />
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
      {notice && (
        <AvailabilityNotice message={notice} onClose={() => setNotice(null)} />
      )}
    </div>
  )
}
