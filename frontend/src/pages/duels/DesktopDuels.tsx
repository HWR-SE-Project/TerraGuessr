import { useState } from 'react'
import { Link } from 'react-router-dom'
import logo from '../../assets/home/desktop/logo.svg'
import headerAvatarRing from '../../assets/home/desktop/header-avatar-ring.png'
import headerAvatarInner from '../../assets/home/desktop/header-avatar-inner.png'

import heroBg from '../../assets/duels/desktop/hero-bg.png'
import heroCrystal from '../../assets/duels/desktop/hero-ghost.png'
import flagLeft from '../../assets/duels/desktop/flag-left.svg'
import rankChampion from '../../assets/duels/desktop/rank-champion.png'
import rankMaster from '../../assets/duels/desktop/rank-master.png'
import rankGold from '../../assets/duels/desktop/rank-gold.png'
import rankSilver from '../../assets/duels/desktop/rank-silver.png'
import rankBronze from '../../assets/duels/desktop/rank-bronze.png'
import rankCurrentBg from '../../assets/duels/desktop/rank-current-bg.png'
import flagRankRow from '../../assets/duels/desktop/flag-rank-row.svg'
import railFlame from '../../assets/duels/desktop/rail-flame-shadow.png'
import railDailyIcon from '../../assets/duels/desktop/rail-daily-icon.png'
import railCompetitiveIcon from '../../assets/duels/desktop/rail-competitive-icon.png'
import railWorldIcon from '../../assets/duels/desktop/rail-world-icon.png'
import railWorldBadge from '../../assets/duels/desktop/rail-world-badge.png'
import { useSession } from '../../state/SessionContext'
import { useDuelFlow } from './useDuelFlow'
import { DuelRoundOverlay } from './DuelRoundOverlay'
import { UnavailableNotice } from '../../components/UnavailableNotice'
import './DesktopDuels.css'

const RANKS = [
  { key: 'champion', label: 'Champion', color: '#00a2fe', icon: rankChampion, dots: false },
  { key: 'master', label: 'Master', color: '#e94555', icon: rankMaster, dots: true },
  { key: 'gold', label: 'Gold', color: '#ffc628', icon: rankGold, dots: true },
  { key: 'silver', label: 'Silver', color: '#ffffff', icon: rankSilver, dots: true },
  { key: 'bronze', label: 'Bronze', color: '#ffa43d', icon: rankBronze, dots: true },
]

export function DesktopDuels() {
  const { user, dailyStreak } = useSession()
  const { stage, busy, start, submitGuess, reset } = useDuelFlow()
  const [comingSoon, setComingSoon] = useState(false)

  return (
    <div className="tg-dl-page">
      <div className="tg-dl-bg-glow" />
      <div className="tg-dl-bg-radial" />

      <header className="tg-dl-header">
        <div className="tg-dl-header-logo-blur" />
        <Link className="tg-dl-logo-link" to="/">
          <img src={logo} alt="TerraGuessr" />
        </Link>

        <Link className="tg-dl-nav-link" style={{ left: 177.45, width: 115 }} to="/play">
          Singleplayer
        </Link>
        <Link className="tg-dl-nav-link" style={{ left: 321.69, width: 86.45 }} to="/duels">
          Multiplayer
        </Link>
        <div className="tg-dl-nav-active" />

        <div className="tg-dl-profile">
          <Link className="tg-dl-profile-avatar" to="/settings" aria-label="Settings">
            <img className="tg-dl-profile-avatar-ring" src={headerAvatarRing} alt="" />
            <div className="tg-dl-profile-avatar-inner">
              <img src={headerAvatarInner} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          </Link>
          <div className="tg-dl-profile-name-wrap">
            <div className="tg-dl-profile-name">{user?.displayName}</div>
          </div>
        </div>
      </header>

      <aside className="tg-dl-left-rail">
        <span className="tg-dl-rail-streak-count">{dailyStreak.current}</span>
        <div className="tg-dl-rail-flame">
          <img src={railFlame} alt="" />
        </div>

        <nav className="tg-dl-rail-nav">
          <Link className="tg-dl-rail-item" to="/daily">
            <img className="tg-dl-rail-item-icon" src={railDailyIcon} alt="" />
            <span className="tg-dl-rail-item-label">Daily challenge</span>
          </Link>
          <button type="button" className="tg-dl-rail-item" onClick={() => setComingSoon(true)}>
            <img className="tg-dl-rail-item-icon" src={railCompetitiveIcon} alt="" />
            <span className="tg-dl-rail-item-label">Competitive</span>
          </button>
          <button type="button" className="tg-dl-rail-item" onClick={() => setComingSoon(true)}>
            <img className="tg-dl-rail-item-icon" src={railWorldIcon} alt="" />
            <img className="tg-dl-rail-item-badge" src={railWorldBadge} alt="" />
            <span className="tg-dl-rail-item-label">World</span>
          </button>
        </nav>
        {comingSoon && <UnavailableNotice>Not available yet — try an async duel below instead.</UnavailableNotice>}
      </aside>

      <main className="tg-dl-main">
        <h1 className="tg-dl-heading">Duels</h1>
        <p className="tg-dl-subheading">Challenge a friend to the same mystery location — no live matchmaking, just a shared leaderboard.</p>

        <div className="tg-dl-hero-mask">
          <img className="tg-dl-hero-bg" src={heroBg} alt="" />
        </div>
        <img className="tg-dl-hero-crystal" src={heroCrystal} alt="" />

        <div className="tg-dl-flag tg-dl-flag--left">
          <img src={flagLeft} alt="" />
        </div>
        <div className="tg-dl-player-name tg-dl-player-name--left">{user?.displayName}</div>

        <button type="button" className="tg-dl-play-btn" onClick={start} disabled={busy}>
          <span>{busy ? 'Starting…' : 'Play'}</span>
        </button>

        <div className="tg-dl-ranks">
          <div className="tg-dl-ranks-overlay" />
          <div className="tg-dl-ranks-line" />
          <span className="tg-dl-ranks-title">Ranks</span>
          <span className="tg-dl-ranks-caption">Ranked ladder — coming soon</span>
          <ol className="tg-dl-ranks-list">
            {RANKS.map((r) => (
              <li key={r.key} className="tg-dl-rank-item">
                <span className="tg-dl-rank-dot" style={{ borderColor: r.color }} />
                <img className="tg-dl-rank-icon" src={r.icon} alt="" />
                <span className="tg-dl-rank-label" style={{ color: r.color }}>
                  {r.label}
                </span>
                {r.dots && (
                  <span className="tg-dl-rank-pips">
                    <i style={{ background: r.color }} />
                    <i style={{ background: r.color }} />
                    <i style={{ background: r.color }} />
                    <i style={{ background: r.color }} />
                  </span>
                )}
              </li>
            ))}
          </ol>
          <div className="tg-dl-rank-current-avatar">
            <img src={rankCurrentBg} alt="" />
          </div>
          <div className="tg-dl-rank-current-flag">
            <img src={flagRankRow} alt="" />
          </div>
          <span className="tg-dl-rank-current-name">{user?.displayName}</span>
          <span className="tg-dl-rank-current-tier">Unranked</span>
        </div>
      </main>

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
