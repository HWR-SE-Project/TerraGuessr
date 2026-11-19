import hamburger from '../../assets/home/mobile/hamburger.svg'
import searchIcon from '../../assets/home/mobile/search-icon.svg'
import avatarRing from '../../assets/home/mobile/header-avatar-ring.png'
import avatarInner from '../../assets/home/mobile/header-avatar-inner.png'
import chevronDown from '../../assets/home/mobile/chevron-down.svg'
import bellIcon from '../../assets/home/mobile/bell-icon.svg'
import navHomeIcon from '../../assets/home/mobile/nav-home-icon.png'
import navDailyIcon from '../../assets/home/mobile/nav-daily-icon.png'
import navCompetitiveIcon from '../../assets/home/mobile/nav-competitive-icon.png'
import navWorldIcon from '../../assets/home/mobile/nav-world-icon.png'

import heroBg from '../../assets/duels/mobile/hero-bg.png'
import heroCrystal from '../../assets/duels/mobile/hero-ghost.png'
import flagLeft from '../../assets/duels/mobile/flag-left.svg'
import './MobileDuels.css'

const DUELS = [
  { label: 'Duel 1', active: true },
  { label: 'Duel 2', active: false },
  { label: 'Duel 3', active: false },
]

export function MobileDuels() {
  return (
    <div className="tg-dm-page">
      <div className="tg-dm-bg-glow" />
      <div className="tg-dm-bg-radial" />

      <header className="tg-dm-header">
        <button type="button" className="tg-dm-hamburger" aria-label="Menu">
          <img src={hamburger} alt="" />
        </button>
        <button type="button" className="tg-dm-search-btn" aria-label="Search">
          <img src={searchIcon} alt="" />
        </button>
        <button type="button" className="tg-dm-avatar-btn" aria-label="Profile">
          <img className="tg-dm-avatar-ring" src={avatarRing} alt="" />
          <div className="tg-dm-avatar-inner">
            <img src={avatarInner} alt="" />
          </div>
        </button>
        <img className="tg-dm-chevron" src={chevronDown} alt="" />
        <button type="button" className="tg-dm-flame-btn" aria-label="Daily streak">
          <div className="tg-dm-flame-bg">
            <span className="tg-dm-flame-label">4</span>
          </div>
        </button>
        <button type="button" className="tg-dm-friends-btn" aria-label="Friends">
          <img src={bellIcon} alt="" />
        </button>
        <span className="tg-dm-friends-badge">1</span>
      </header>

      <main className="tg-dm-main">
        <h1 className="tg-dm-heading">Duels</h1>
        <p className="tg-dm-subheading">Play 3 duels to get ranked</p>

        <div className="tg-dm-hero-mask">
          <img className="tg-dm-hero-bg" src={heroBg} alt="" />
        </div>
        <img className="tg-dm-hero-crystal" src={heroCrystal} alt="" />

        <div className="tg-dm-flag">
          <img src={flagLeft} alt="" />
        </div>
        <div className="tg-dm-player-name tg-dm-player-name--left">Maximpolakovskij</div>
        <div className="tg-dm-player-name tg-dm-player-name--right">Unknown player</div>

        <ol className="tg-dm-duel-tabs">
          {DUELS.map((d) => (
            <li key={d.label} className={`tg-dm-duel-tab${d.active ? ' tg-dm-duel-tab--active' : ''}`}>
              <span>{d.label}</span>
            </li>
          ))}
        </ol>

        <button type="button" className="tg-dm-play-btn">
          <span>Play</span>
        </button>
      </main>

      <nav className="tg-dm-nav">
        <div className="tg-dm-nav-list">
          <a className="tg-dm-nav-item" href="/" style={{ opacity: 0.5 }}>
            <img src={navHomeIcon} alt="" style={{ marginTop: -8 }} />
            <span>Home</span>
          </a>
          <a className="tg-dm-nav-item" href="#daily-challenge" style={{ opacity: 0.5 }}>
            <img src={navDailyIcon} alt="" style={{ marginTop: -15 }} />
            <span>
              Daily
              <br />
              challenge
            </span>
          </a>
          <div className="tg-dm-nav-item tg-dm-nav-item--active">
            <div className="tg-dm-nav-highlight" />
            <img src={navCompetitiveIcon} alt="" style={{ marginTop: -8 }} />
            <span>Competitive</span>
          </div>
          <div className="tg-dm-nav-item" style={{ cursor: 'default', opacity: 0.5 }}>
            <img src={navWorldIcon} alt="" style={{ marginTop: -8 }} />
            <span>World</span>
          </div>
        </div>
      </nav>
    </div>
  )
}
