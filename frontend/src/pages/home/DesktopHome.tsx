import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import logo from '../../assets/home/desktop/logo.svg'
import headerAvatarRing from '../../assets/home/desktop/header-avatar-ring.png'
import headerAvatarInner from '../../assets/home/desktop/header-avatar-inner.png'
import streakFlameShadow from '../../assets/home/desktop/streak-badge-shadow.png'
import cardDailyBg from '../../assets/home/desktop/card-daily-bg.png'
import cardDailyIcon from '../../assets/home/desktop/card-daily-icon.png'
import cardCompetitiveBg from '../../assets/home/desktop/card-competitive-bg.png'
import cardCompetitiveIcon from '../../assets/home/desktop/card-competitive-icon.png'
import cardWorldBg from '../../assets/home/desktop/card-world-bg.png'
import cardWorldIcon from '../../assets/home/desktop/card-world-icon.png'
import proLock from '../../assets/home/desktop/pro-lock.png'
import globeBottom from '../../assets/home/desktop/globe-bottom.png'
import avatarGlobeTop from '../../assets/home/desktop/avatar-globe-top.png'
import { useSession } from '../../state/SessionContext'
import { useHomeData } from '../../hooks/useHomeData'
import { UnavailableNotice } from '../../components/UnavailableNotice'
import './DesktopHome.css'

export function DesktopHome() {
  const navigate = useNavigate()
  const { user, dailyStreak } = useSession()
  const { daily, soloStats, streakDays, hoursUntilDailyReset } = useHomeData()
  const [showAvatarNotice, setShowAvatarNotice] = useState(false)
  const [showCompetitiveNotice, setShowCompetitiveNotice] = useState(false)

  const dailySubtitle = daily?.status === 'completed' ? "Today's done" : `${hoursUntilDailyReset} hr left`

  return (
    <div className="tg-hd-page">
      <div className="tg-hd-bg-glow" />
      <div className="tg-hd-bg-radial" />

      <header className="tg-hd-header">
        <div className="tg-hd-header-logo-blur" />
        <Link className="tg-hd-logo-link" to="/">
          <img src={logo} alt="TerraGuessr" />
        </Link>

        <Link className="tg-hd-nav-link" style={{ left: 177.45, width: 115 }} to="/play">
          Singleplayer
        </Link>
        <Link className="tg-hd-nav-link" style={{ left: 321.69, width: 86.45 }} to="/duels">
          Multiplayer
        </Link>

        <div className="tg-hd-profile">
          <Link className="tg-hd-profile-avatar" to="/settings" aria-label="Settings">
            <img className="tg-hd-profile-avatar-ring" src={headerAvatarRing} alt="" />
            <div className="tg-hd-profile-avatar-inner">
              <img src={headerAvatarInner} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          </Link>
          <div className="tg-hd-profile-name-wrap">
            <div className="tg-hd-profile-name">{user?.displayName}</div>
          </div>
        </div>

        <button type="button" className="tg-hd-flame-btn" aria-label="Daily streak" onClick={() => navigate('/daily')}>
          <div className="tg-hd-flame-bg">
            <span className="tg-hd-flame-label">{dailyStreak.current}</span>
          </div>
        </button>
      </header>

      <aside className="tg-hd-left-rail">
        <div className="tg-hd-streak">
          <div className="tg-hd-streak-label">
            <span>{dailyStreak.current} day streak</span>
          </div>
          <div className="tg-hd-streak-grid">
            {streakDays.map((day, i) => (
              <span key={`label-${i}`} className="tg-hd-streak-day-label" style={{ left: 21.69 + i * 29.21 }}>
                {day.label}
              </span>
            ))}
            {streakDays.map((day, i) => (
              <span
                key={`cell-${i}`}
                className={`tg-hd-streak-cell${day.isToday ? ' tg-hd-streak-cell--active' : ''}${!day.completed && !day.isToday ? ' tg-hd-streak-cell--dim' : ''}`}
                style={{ left: 12.25 + i * 29 }}
              >
                {day.dayOfMonth}
              </span>
            ))}
            <div className="tg-hd-streak-flame">
              <img src={streakFlameShadow} alt="" />
            </div>
          </div>
        </div>

        <div className="tg-hd-nav-cards">
          <Link className="tg-hd-nav-card" to="/daily">
            <img className="tg-hd-nav-card-icon" src={cardDailyBg} alt="" style={{ left: 0, top: 0, width: '100%', height: '100%', position: 'absolute', objectFit: 'cover' }} />
            <img className="tg-hd-nav-card-icon" src={cardDailyIcon} alt="" />
            <span className="tg-hd-nav-card-title">Daily Challenge</span>
            <span className="tg-hd-nav-card-subtitle">{dailySubtitle}</span>
          </Link>
          <button type="button" className="tg-hd-nav-card" style={{ cursor: 'default', border: 0, textAlign: 'left' }} onClick={() => setShowCompetitiveNotice(true)}>
            <img src={cardCompetitiveBg} alt="" style={{ left: 0, top: 0, width: '100%', height: '100%', position: 'absolute', objectFit: 'cover' }} />
            <img className="tg-hd-nav-card-icon" src={cardCompetitiveIcon} alt="" />
            <span className="tg-hd-nav-card-title">Competitive</span>
            <span className="tg-hd-nav-card-subtitle tg-hd-nav-card-subtitle--ranked">Coming soon</span>
          </button>
          <div className="tg-hd-nav-card" style={{ cursor: 'default' }}>
            <img src={cardWorldBg} alt="" style={{ left: 0, top: 0, width: '100%', height: '100%', position: 'absolute', objectFit: 'cover' }} />
            <img className="tg-hd-nav-card-icon" src={cardWorldIcon} alt="" />
            <span className="tg-hd-nav-card-title">World</span>
            <div className="tg-hd-nav-card-lock">
              <span>Coming soon</span>
              <img src={proLock} alt="" />
            </div>
          </div>
        </div>

        {showCompetitiveNotice && (
          <UnavailableNotice>Ranked competitive play isn&apos;t available yet. Try an async challenge from Duels instead.</UnavailableNotice>
        )}
      </aside>

      <main className="tg-hd-main">
        <div className="tg-hd-recent">
          {soloStats && soloStats.entries.length > 0 ? (
            <>
              <span className="tg-hd-recent-tag">
                <span className="tg-hd-recent-tag-bg" />
                <span className="tg-hd-recent-tag-dot" />
                <span className="tg-hd-recent-tag-text">Last round</span>
              </span>
              <span className="tg-hd-recent-name" style={{ left: 115 }}>
                {soloStats.entries[0]!.locationName ?? 'Unknown location'} · {soloStats.entries[0]!.score.toLocaleString()} pts
              </span>
            </>
          ) : (
            <span className="tg-hd-recent-name" style={{ left: 0 }}>
              Play your first round to see stats here.
            </span>
          )}
        </div>

        <div className="tg-hd-avatar-stage">
          <img className="tg-hd-globe" src={globeBottom} alt="" />
          <img className="tg-hd-avatar" src={avatarGlobeTop} alt="Player avatar" />
          <button type="button" className="tg-hd-edit-avatar" onClick={() => setShowAvatarNotice(true)}>
            <span>Edit avatar</span>
            <i className="tg-hd-edit-avatar-dot" />
          </button>
          {showAvatarNotice && <UnavailableNotice>Avatar customization isn&apos;t available yet.</UnavailableNotice>}
        </div>

        <Link to="/play" className="tg-hd-play-cta">
          Play a round
        </Link>
      </main>
    </div>
  )
}
