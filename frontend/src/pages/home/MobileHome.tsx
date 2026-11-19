import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import hamburger from '../../assets/home/mobile/hamburger.svg'
import avatarRing from '../../assets/home/mobile/header-avatar-ring.png'
import avatarInner from '../../assets/home/mobile/header-avatar-inner.png'
import globeBottom from '../../assets/home/mobile/globe-bottom.png'
import avatarGlobeTop from '../../assets/home/mobile/avatar-globe-top.png'
import navHomeIcon from '../../assets/home/mobile/nav-home-icon.png'
import navDailyIcon from '../../assets/home/mobile/nav-daily-icon.png'
import navCompetitiveIcon from '../../assets/home/mobile/nav-competitive-icon.png'
import navWorldIcon from '../../assets/home/mobile/nav-world-icon.png'
import { useSession } from '../../state/SessionContext'
import { useHomeData } from '../../hooks/useHomeData'
import { UnavailableNotice } from '../../components/UnavailableNotice'
import './MobileHome.css'

export function MobileHome() {
  const navigate = useNavigate()
  const { user, dailyStreak, logout } = useSession()
  const { daily, soloStats, hoursUntilDailyReset } = useHomeData()
  const [menuOpen, setMenuOpen] = useState(false)
  const [showAvatarNotice, setShowAvatarNotice] = useState(false)
  const [showComingSoon, setShowComingSoon] = useState(false)

  const dailySubtitle = daily?.status === 'completed' ? "Today's done" : `${hoursUntilDailyReset} hr left`

  async function handleLogout() {
    await logout()
    setMenuOpen(false)
    navigate('/')
  }

  return (
    <div className="tg-hm-page">
      <div className="tg-hm-bg-glow" />
      <div className="tg-hm-bg-radial" />

      <header className="tg-hm-header">
        <button type="button" className="tg-hm-hamburger" aria-label="Menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)}>
          <img src={hamburger} alt="" />
        </button>
        <Link to="/settings" className="tg-hm-avatar-btn" aria-label="Settings">
          <img className="tg-hm-avatar-ring" src={avatarRing} alt="" />
          <div className="tg-hm-avatar-inner">
            <img src={avatarInner} alt="" />
          </div>
        </Link>
        <button type="button" className="tg-hm-flame-btn" aria-label="Daily streak" onClick={() => navigate('/daily')}>
          <div className="tg-hm-flame-bg">
            <span className="tg-hm-flame-label">{dailyStreak.current}</span>
          </div>
        </button>
      </header>

      {menuOpen && (
        <div className="tg-hm-menu" role="menu">
          <span className="tg-hm-menu-name">{user?.displayName}</span>
          <Link to="/play" role="menuitem" onClick={() => setMenuOpen(false)}>Play a round</Link>
          <Link to="/duels" role="menuitem" onClick={() => setMenuOpen(false)}>Duels</Link>
          <Link to="/daily" role="menuitem" onClick={() => setMenuOpen(false)}>Daily challenge</Link>
          <Link to="/settings" role="menuitem" onClick={() => setMenuOpen(false)}>Settings</Link>
          <button type="button" role="menuitem" onClick={handleLogout}>Log out</button>
        </div>
      )}

      <main className="tg-hm-main">
        <div className="tg-hm-section">
          {soloStats && soloStats.entries.length > 0 ? (
            <p className="tg-hm-last-round">
              Last round: {soloStats.entries[0]!.locationName ?? 'Unknown location'} · {soloStats.entries[0]!.score.toLocaleString()} pts
            </p>
          ) : (
            <p className="tg-hm-last-round">Play your first round to see stats here.</p>
          )}
          <p className="tg-hm-last-round">Daily challenge: {dailySubtitle}</p>

          <div className="tg-hm-avatar-stage">
            <img className="tg-hm-globe" src={globeBottom} alt="" />
            <img className="tg-hm-avatar" src={avatarGlobeTop} alt="Player avatar" />
            <button type="button" className="tg-hm-edit-avatar" onClick={() => setShowAvatarNotice(true)}>
              <span>Edit avatar</span>
              <i className="tg-hm-edit-avatar-dot" />
            </button>
          </div>
          {showAvatarNotice && <UnavailableNotice>Avatar customization isn&apos;t available yet.</UnavailableNotice>}

          <Link to="/play" className="tg-hm-play-cta">
            Play a round
          </Link>
        </div>
      </main>

      {showComingSoon && <UnavailableNotice>Ranked competitive play isn&apos;t available yet. Try Duels for an async challenge.</UnavailableNotice>}

      <nav className="tg-hm-nav">
        <div className="tg-hm-nav-list">
          <Link className="tg-hm-nav-item tg-hm-nav-item--active" to="/">
            <div className="tg-hm-nav-highlight" />
            <img src={navHomeIcon} alt="" style={{ marginTop: -8 }} />
            <span>Home</span>
          </Link>
          <Link className="tg-hm-nav-item" to="/daily">
            <img src={navDailyIcon} alt="" style={{ marginTop: -15 }} />
            <span>
              Daily
              <br />
              challenge
            </span>
          </Link>
          <button type="button" className="tg-hm-nav-item" onClick={() => setShowComingSoon(true)}>
            <img src={navCompetitiveIcon} alt="" style={{ marginTop: -8 }} />
            <span>Competitive</span>
          </button>
          <button type="button" className="tg-hm-nav-item" onClick={() => setShowComingSoon(true)}>
            <img src={navWorldIcon} alt="" style={{ marginTop: -8 }} />
            <span>World</span>
          </button>
        </div>
      </nav>
    </div>
  )
}
