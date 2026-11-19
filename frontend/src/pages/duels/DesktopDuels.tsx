import logo from '../../assets/home/desktop/logo.svg'
import chevronDown from '../../assets/home/desktop/chevron-down.svg'
import searchIcon from '../../assets/home/desktop/search-icon.svg'
import headerAvatarRing from '../../assets/home/desktop/header-avatar-ring.png'
import headerAvatarInner from '../../assets/home/desktop/header-avatar-inner.png'
import headerXpBar from '../../assets/home/desktop/header-xp-bar.png'
import railSearchIcon from '../../assets/home/desktop/rail-search-icon.svg'
import railClubIcon from '../../assets/home/desktop/rail-club-icon.svg'
import railHorrorIcon from '../../assets/home/desktop/rail-horror-icon.png'
import railBrCountriesBg from '../../assets/home/desktop/rail-br-countries-bg.png'
import railBrCountriesIcon from '../../assets/home/desktop/rail-br-countries-icon.png'
import railBrDistanceBg from '../../assets/home/desktop/rail-br-distance-bg.png'
import railBrDistanceIcon from '../../assets/home/desktop/rail-br-distance-icon.png'

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
import './DesktopDuels.css'

const RANKS = [
  { key: 'champion', label: 'Champion', color: '#00a2fe', icon: rankChampion, dots: false },
  { key: 'master', label: 'Master', color: '#e94555', icon: rankMaster, dots: true },
  { key: 'gold', label: 'Gold', color: '#ffc628', icon: rankGold, dots: true },
  { key: 'silver', label: 'Silver', color: '#ffffff', icon: rankSilver, dots: true },
  { key: 'bronze', label: 'Bronze', color: '#ffa43d', icon: rankBronze, dots: true },
]

const DUELS = [
  { label: 'Duel 1', active: true },
  { label: 'Duel 2', active: false },
  { label: 'Duel 3', active: false },
]

export function DesktopDuels() {
  return (
    <div className="tg-dl-page">
      <div className="tg-dl-bg-glow" />
      <div className="tg-dl-bg-radial" />

      <header className="tg-dl-header">
        <div className="tg-dl-header-logo-blur" />
        <a className="tg-dl-logo-link" href="/">
          <img src={logo} alt="GeoGuessr" />
        </a>

        <span className="tg-dl-nav-link" style={{ left: 188, width: 93.89 }}>
          Singleplayer
        </span>
        <div className="tg-dl-nav-chevron" style={{ left: 289.69 }}>
          <img src={chevronDown} alt="" />
        </div>
        <span className="tg-dl-nav-link" style={{ left: 321.69, width: 86.45 }}>
          Multiplayer
        </span>
        <div className="tg-dl-nav-chevron" style={{ left: 415.94 }}>
          <img src={chevronDown} alt="" />
        </div>
        <div className="tg-dl-nav-active" />
        <span className="tg-dl-nav-link" style={{ left: 447.94, width: 41.73 }}>
          Party
        </span>
        <div className="tg-dl-nav-chevron" style={{ left: 497.47 }}>
          <img src={chevronDown} alt="" />
        </div>
        <div className="tg-dl-nav-divider" />
        <a className="tg-dl-sub-link" href="#community" style={{ left: 554.47 }}>
          Community
        </a>
        <div className="tg-dl-shop-link">
          <a className="tg-dl-sub-link" href="#shop">
            Shop
          </a>
          <span className="tg-dl-shop-dot" />
        </div>
        <a className="tg-dl-sub-link" href="#merch" style={{ left: 701.97 }}>
          Merch
        </a>
        <a className="tg-dl-sub-link" href="#world-championship" style={{ left: 764.89 }}>
          World Championship
        </a>

        <div className="tg-dl-profile">
          <div className="tg-dl-profile-avatar">
            <img className="tg-dl-profile-avatar-ring" src={headerAvatarRing} alt="" />
            <div className="tg-dl-profile-avatar-inner">
              <img src={headerAvatarInner} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          </div>
          <div className="tg-dl-profile-name-wrap">
            <div className="tg-dl-profile-name">Maximpolakovskij</div>
            <img className="tg-dl-profile-xp-bar" src={headerXpBar} alt="" />
            <span className="tg-dl-profile-xp-label">75</span>
          </div>
        </div>
        <div className="tg-dl-nav-chevron" style={{ left: 1788 }}>
          <img src={chevronDown} alt="" />
        </div>

        <button type="button" className="tg-dl-flame-btn" aria-label="Daily streak">
          <div className="tg-dl-flame-bg">
            <span className="tg-dl-flame-label">4</span>
          </div>
        </button>

        <button type="button" className="tg-dl-search-btn" aria-label="Search">
          <img src={searchIcon} alt="" />
        </button>
      </header>

      <aside className="tg-dl-left-rail">
        <span className="tg-dl-rail-streak-count">0</span>
        <div className="tg-dl-rail-flame">
          <img src={railFlame} alt="" />
        </div>

        <nav className="tg-dl-rail-nav">
          <a className="tg-dl-rail-item" href="#daily-challenge">
            <img className="tg-dl-rail-item-icon" src={railDailyIcon} alt="" />
            <span className="tg-dl-rail-item-label">Daily challenge</span>
          </a>
          <a className="tg-dl-rail-item" href="#competitive">
            <img className="tg-dl-rail-item-icon" src={railCompetitiveIcon} alt="" />
            <span className="tg-dl-rail-item-label">Competitive</span>
          </a>
          <div className="tg-dl-rail-item" style={{ cursor: 'default' }}>
            <img className="tg-dl-rail-item-icon" src={railWorldIcon} alt="" />
            <img className="tg-dl-rail-item-badge" src={railWorldBadge} alt="" />
            <span className="tg-dl-rail-item-label">World</span>
          </div>
        </nav>
      </aside>

      <main className="tg-dl-main">
        <h1 className="tg-dl-heading">Duels</h1>
        <p className="tg-dl-subheading">Play 3 duels to get ranked</p>

        <div className="tg-dl-hero-mask">
          <img className="tg-dl-hero-bg" src={heroBg} alt="" />
        </div>
        <img className="tg-dl-hero-crystal" src={heroCrystal} alt="" />

        <div className="tg-dl-flag tg-dl-flag--left">
          <img src={flagLeft} alt="" />
        </div>
        <div className="tg-dl-player-name tg-dl-player-name--left">Maximpolakovskij</div>
        <div className="tg-dl-player-name tg-dl-player-name--right">Unknown player</div>

        <ol className="tg-dl-duel-tabs">
          {DUELS.map((d) => (
            <li key={d.label} className={`tg-dl-duel-tab${d.active ? ' tg-dl-duel-tab--active' : ''}`}>
              <span>{d.label}</span>
            </li>
          ))}
        </ol>

        <button type="button" className="tg-dl-play-btn">
          <span>Play</span>
        </button>

        <div className="tg-dl-ranks">
          <div className="tg-dl-ranks-overlay" />
          <div className="tg-dl-ranks-line" />
          <span className="tg-dl-ranks-title">Ranks</span>
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
          <span className="tg-dl-rank-current-name">Maximpolakovskij</span>
          <span className="tg-dl-rank-current-tier">Unranked</span>
        </div>
      </main>

      <div className="tg-dl-right-flyout">
        <div style={{ padding: '12px 12px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 34, border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '0 10px' }}>
            <img src={railSearchIcon} alt="" style={{ width: 14, height: 14 }} />
            <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>Search users...</span>
          </div>
          <a href="#find-club" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0' }}>
            <span style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img src={railClubIcon} alt="" style={{ width: 16, height: 16 }} />
            </span>
            <span>
              <span style={{ display: 'block', fontSize: 13.2, color: '#fff' }}>Find your club</span>
              <span style={{ display: 'block', fontSize: 11.6, color: 'rgba(255,255,255,0.6)' }}>Compete together</span>
            </span>
          </a>
        </div>
        <a href="#horrorguessr" style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '0 12px', height: 60, borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <img src={railHorrorIcon} alt="" style={{ width: 32, height: 32, borderRadius: 6 }} />
          <span style={{ fontWeight: 700, fontStyle: 'italic', fontSize: 13.3, color: '#fff' }}>Play HorrorGuessr Now!</span>
        </a>
        <a href="#battle-royale-countries" style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12, padding: '0 12px', height: 48 }}>
          <img src={railBrCountriesBg} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.3 }} />
          <img src={railBrCountriesIcon} alt="" style={{ position: 'relative', width: 32, height: 32 }} />
          <span style={{ position: 'relative', fontWeight: 700, fontStyle: 'italic', fontSize: 13.5, color: '#68c045' }}>Battle royale countries</span>
        </a>
        <a href="#battle-royale-distance" style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12, padding: '0 12px', height: 48 }}>
          <img src={railBrDistanceBg} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.3 }} />
          <img src={railBrDistanceIcon} alt="" style={{ position: 'relative', width: 32, height: 32 }} />
          <span style={{ position: 'relative', fontWeight: 700, fontStyle: 'italic', fontSize: 13.5, color: '#68c045' }}>Battle royale distance</span>
        </a>
      </div>
    </div>
  )
}
