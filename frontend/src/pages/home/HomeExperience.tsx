import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useSession } from '../../state/SessionContext'
import { useHomeData } from '../../hooks/useHomeData'
import character from '../../assets/home/official/explorer.webp'
import earth from '../../assets/home/official/earth-horizon.webp'
import defaultAvatar from '../../assets/home/official/alpine-lake.webp'
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

function UserProfileSummary() {
  const { user } = useSession()
  return (
    <div className="th-profile">
      <Link to="/settings" className="th-profile-link" aria-label="Settings">
        <span className="th-profile-avatar" aria-hidden="true">
          <img src={defaultAvatar} alt="" />
        </span>
        <span className="th-profile-details">
          <span className="th-profile-name">
            {user?.displayName ?? 'Guest'}
          </span>
          <span className="th-currency" title="Currency is not available yet">
            <HomeIcon name="coin" />
            <span aria-label="Currency unavailable">—</span>
          </span>
        </span>
      </Link>
    </div>
  )
}

function HomeNavigation({ showNotice }: { showNotice: ShowNotice }) {
  const [menuOpen, setMenuOpen] = useState(false)
  return (
    <header className="th-header">
      <Link to="/" className="th-brand" aria-label="TerraGuessr home">
        <span className="th-brand-mark">T</span>
        <span className="th-wordmark">
          Terra<span>Guessr</span>
        </span>
      </Link>
      <nav
        className={`th-navigation${menuOpen ? ' th-navigation-open' : ''}`}
        aria-label="Main navigation"
      >
        <Link to="/play" className="th-nav-item th-nav-active">
          Singleplayer
        </Link>
        <Link to="/duels" className="th-nav-item">
          Multiplayer
        </Link>
        <UnavailableButton
          className="th-nav-item"
          message="Party lobbies are not available yet. You can challenge a friend in Duels."
          showNotice={showNotice}
        >
          Party
        </UnavailableButton>
      </nav>
      <UnavailableButton
        className="th-search"
        label="Search"
        message="Player and map search is not available yet."
        showNotice={showNotice}
      >
        <HomeIcon name="search" />
      </UnavailableButton>
      <span className="th-profile-divider" />
      <UserProfileSummary />
      <button
        className="th-menu-button"
        type="button"
        aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen(!menuOpen)}
      >
        <HomeIcon name={menuOpen ? 'close' : 'menu'} />
      </button>
    </header>
  )
}

function HomeSidebar({
  data,
  showNotice,
}: {
  data: ReturnType<typeof useHomeData>
  showNotice: ShowNotice
}) {
  return (
    <aside className="th-sidebar" aria-label="Daily activities">
      <Link className="th-sidebar-card th-glass" to="/daily">
        <span className="th-feature-icon">
          <HomeIcon name="calendar" />
        </span>
        <span>
          <strong>Daily Challenge</strong>
          <small>
            {data.loading
              ? 'Loading challenge…'
              : data.error
                ? 'Try daily challenge'
                : data.daily?.status === 'completed'
                  ? "Today's done"
                  : `${data.hoursUntilDailyReset} hr left`}
          </small>
        </span>
        <HomeIcon name="chevron" />
      </Link>
      <Link className="th-sidebar-card th-glass" to="/duels">
        <span className="th-feature-icon th-feature-lime">
          <HomeIcon name="trophy" />
        </span>
        <span>
          <strong>Competitive</strong>
          <small>Challenge a friend</small>
        </span>
        <HomeIcon name="chevron" />
      </Link>
      <UnavailableButton
        className="th-sidebar-card th-world th-glass"
        message="World subscriptions are not available yet. World geography is available in Play Solo."
        showNotice={showNotice}
      >
        <span className="th-feature-icon">
          <HomeIcon name="globe" />
        </span>
        <span>
          <strong>World</strong>
          <small>Subscribers only</small>
        </span>
        <HomeIcon name="lock" />
      </UnavailableButton>
    </aside>
  )
}

function HeroSection({ showNotice }: { showNotice: ShowNotice }) {
  return (
    <main className="th-hero" id="home-main">
      <div className="th-hero-copy">
        <p className="th-eyebrow">A GEOGRAPHY GUESSING GAME</p>
        <h1>
          Explore the <span>World</span>
        </h1>
      </div>
      <div className="th-avatar-display">
        <img
          src={character}
          className="th-character"
          alt="TerraGuessr character with dark swept hair, a striped blue shirt and khaki trousers"
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
  const data = useHomeData()
  const [notice, setNotice] = useState<string | null>(null)
  return (
    <div className="th-home">
      <a className="th-skip" href="#home-main">
        Skip to content
      </a>
      <div className="th-earth" aria-hidden="true">
        <img src={earth} alt="" />
      </div>
      <HomeNavigation showNotice={setNotice} />
      <HomeSidebar data={data} showNotice={setNotice} />
      <HeroSection showNotice={setNotice} />
      <nav className="th-game-modes" aria-label="Game modes">
        <GameModeCard
          to="/play"
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
