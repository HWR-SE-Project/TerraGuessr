import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import hamburger from '../../assets/home/mobile/hamburger.svg'
import avatarRing from '../../assets/home/mobile/header-avatar-ring.png'
import avatarInner from '../../assets/home/mobile/header-avatar-inner.png'
import navHomeIcon from '../../assets/home/mobile/nav-home-icon.png'
import navDailyIcon from '../../assets/home/mobile/nav-daily-icon.png'
import navCompetitiveIcon from '../../assets/home/mobile/nav-competitive-icon.png'
import navWorldIcon from '../../assets/home/mobile/nav-world-icon.png'

import heroBg from '../../assets/duels/mobile/hero-bg.png'
import heroCrystal from '../../assets/duels/mobile/hero-ghost.png'
import flagLeft from '../../assets/duels/mobile/flag-left.svg'
import { useSession } from '../../state/SessionContext'
import { useDuelFlow } from './useDuelFlow'
import { DuelRoundOverlay } from './DuelRoundOverlay'
import { UnavailableNotice } from '../../components/UnavailableNotice'
import './MobileDuels.css'

export function MobileDuels() {
  const navigate = useNavigate()
  const { user, dailyStreak, logout } = useSession()
  const { stage, busy, start, submitGuess, reset } = useDuelFlow()
  const [menuOpen, setMenuOpen] = useState(false)
  const [comingSoon, setComingSoon] = useState(false)

  async function handleLogout() {
    await logout()
    setMenuOpen(false)
    navigate('/')
  }

  return (
    <div className="tg-dm-page">
      <div className="tg-dm-bg-glow" />
      <div className="tg-dm-bg-radial" />

      <header className="tg-dm-header">
        <button type="button" className="tg-dm-hamburger" aria-label="Menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)}>
          <img src={hamburger} alt="" />
        </button>
        <Link to="/settings" className="tg-dm-avatar-btn" aria-label="Settings">
          <img className="tg-dm-avatar-ring" src={avatarRing} alt="" />
          <div className="tg-dm-avatar-inner">
            <img src={avatarInner} alt="" />
          </div>
        </Link>
        <button type="button" className="tg-dm-flame-btn" aria-label="Daily streak" onClick={() => navigate('/daily')}>
          <div className="tg-dm-flame-bg">
            <span className="tg-dm-flame-label">{dailyStreak.current}</span>
          </div>
        </button>
      </header>

      {menuOpen && (
        <div className="tg-dm-menu" role="menu">
          <span className="tg-dm-menu-name">{user?.displayName}</span>
          <Link to="/play" role="menuitem" onClick={() => setMenuOpen(false)}>Play a round</Link>
          <Link to="/daily" role="menuitem" onClick={() => setMenuOpen(false)}>Daily challenge</Link>
          <Link to="/settings" role="menuitem" onClick={() => setMenuOpen(false)}>Settings</Link>
          <button type="button" role="menuitem" onClick={handleLogout}>Log out</button>
        </div>
      )}

      <main className="tg-dm-main">
        <h1 className="tg-dm-heading">Duels</h1>
        <p className="tg-dm-subheading">Challenge a friend to the same location — no live matchmaking, just a shared leaderboard.</p>

        <div className="tg-dm-hero-mask">
          <img className="tg-dm-hero-bg" src={heroBg} alt="" />
        </div>
        <img className="tg-dm-hero-crystal" src={heroCrystal} alt="" />

        <div className="tg-dm-flag">
          <img src={flagLeft} alt="" />
        </div>
        <div className="tg-dm-player-name tg-dm-player-name--left">{user?.displayName}</div>

        <button type="button" className="tg-dm-play-btn" onClick={start} disabled={busy}>
          <span>{busy ? 'Starting…' : 'Play'}</span>
        </button>
      </main>

      {comingSoon && <UnavailableNotice>Not available yet — try an async duel above instead.</UnavailableNotice>}

      <nav className="tg-dm-nav">
        <div className="tg-dm-nav-list">
          <Link className="tg-dm-nav-item" to="/">
            <img src={navHomeIcon} alt="" style={{ marginTop: -8 }} />
            <span>Home</span>
          </Link>
          <Link className="tg-dm-nav-item" to="/daily">
            <img src={navDailyIcon} alt="" style={{ marginTop: -15 }} />
            <span>
              Daily
              <br />
              challenge
            </span>
          </Link>
          <div className="tg-dm-nav-item tg-dm-nav-item--active">
            <div className="tg-dm-nav-highlight" />
            <img src={navCompetitiveIcon} alt="" style={{ marginTop: -8 }} />
            <span>Duels</span>
          </div>
          <button type="button" className="tg-dm-nav-item" onClick={() => setComingSoon(true)}>
            <img src={navWorldIcon} alt="" style={{ marginTop: -8 }} />
            <span>World</span>
          </button>
        </div>
      </nav>

      {stage.kind !== 'idle' && (
        <DuelRoundOverlay
          round={stage.kind === 'round' ? stage.round : null}
          creating={stage.kind === 'creating'}
          busy={busy}
          error={stage.kind === 'error' ? stage.message : null}
          onSubmit={submitGuess}
          onClose={reset}
        />
      )}
    </div>
  )
}
