import logo from '../../assets/home/desktop/logo.svg'
import chevronDown from '../../assets/home/desktop/chevron-down.svg'
import searchIcon from '../../assets/home/desktop/search-icon.svg'
import headerAvatarRing from '../../assets/home/desktop/header-avatar-ring.png'
import headerAvatarInner from '../../assets/home/desktop/header-avatar-inner.png'
import headerXpBar from '../../assets/home/desktop/header-xp-bar.png'
import streakFlameShadow from '../../assets/home/desktop/streak-badge-shadow.png'
import cardDailyBg from '../../assets/home/desktop/card-daily-bg.png'
import cardDailyIcon from '../../assets/home/desktop/card-daily-icon.png'
import cardCompetitiveBg from '../../assets/home/desktop/card-competitive-bg.png'
import cardCompetitiveIcon from '../../assets/home/desktop/card-competitive-icon.png'
import cardWorldBg from '../../assets/home/desktop/card-world-bg.png'
import cardWorldIcon from '../../assets/home/desktop/card-world-icon.png'
import proLock from '../../assets/home/desktop/pro-lock.png'
import sidebarHorrorPromo from '../../assets/home/desktop/sidebar-horror-promo.png'
import matchupPatrick from '../../assets/home/desktop/matchup-patrick.png'
import matchupUnclepanda from '../../assets/home/desktop/matchup-unclepanda.png'
import flagPatrick from '../../assets/home/desktop/flag-patrick.svg'
import flagUnclepanda from '../../assets/home/desktop/flag-unclepanda.svg'
import arrowLeft from '../../assets/home/desktop/arrow-left.svg'
import onlineFace1 from '../../assets/home/desktop/online-face-1.png'
import onlineFace2 from '../../assets/home/desktop/online-face-2.png'
import onlineFace3 from '../../assets/home/desktop/online-face-3.png'
import globeBottom from '../../assets/home/desktop/globe-bottom.png'
import avatarGlobeTop from '../../assets/home/desktop/avatar-globe-top.png'
import horrorChar from '../../assets/home/desktop/horror-char.png'
import subscriptionIllustration from '../../assets/home/desktop/subscription-illustration.png'
import checkmark from '../../assets/home/desktop/checkmark.svg'
import socialTwitch from '../../assets/home/desktop/social-twitch.svg'
import socialReddit from '../../assets/home/desktop/social-reddit.svg'
import socialDiscord from '../../assets/home/desktop/social-discord-fill.svg'
import socialFacebook from '../../assets/home/desktop/social-facebook.svg'
import socialInstagram from '../../assets/home/desktop/social-instagram.svg'
import socialX from '../../assets/home/desktop/social-x.svg'
import socialYoutube from '../../assets/home/desktop/social-youtube.svg'
import socialTiktok from '../../assets/home/desktop/social-tiktok.svg'
import railSearchIcon from '../../assets/home/desktop/rail-search-icon.svg'
import railClubIcon from '../../assets/home/desktop/rail-club-icon.svg'
import railHorrorIcon from '../../assets/home/desktop/rail-horror-icon.png'
import railBrCountriesBg from '../../assets/home/desktop/rail-br-countries-bg.png'
import railBrCountriesIcon from '../../assets/home/desktop/rail-br-countries-icon.png'
import railBrDistanceBg from '../../assets/home/desktop/rail-br-distance-bg.png'
import railBrDistanceIcon from '../../assets/home/desktop/rail-br-distance-icon.png'
import './DesktopHome.css'

const STREAK_DAYS = [
  { label: 'T', num: '12' },
  { label: 'F', num: '13' },
  { label: 'S', num: '14' },
  { label: 'S', num: '15', active: true },
  { label: 'M', num: '16', dim: true },
  { label: 'T', num: '17', dim: true },
  { label: 'W', num: '18', dim: true },
]

const SOCIAL_LINKS = [
  { name: 'Twitch', icon: socialTwitch },
  { name: 'Reddit', icon: socialReddit },
  { name: 'Discord', icon: socialDiscord },
  { name: 'Facebook', icon: socialFacebook },
  { name: 'Instagram', icon: socialInstagram },
  { name: 'X', icon: socialX },
  { name: 'YouTube', icon: socialYoutube },
  { name: 'TikTok', icon: socialTiktok },
]

export function DesktopHome() {
  return (
    <div className="tg-hd-page">
      <div className="tg-hd-bg-glow" />
      <div className="tg-hd-bg-radial" />

      <header className="tg-hd-header">
        <div className="tg-hd-header-logo-blur" />
        <a className="tg-hd-logo-link" href="/">
          <img src={logo} alt="GeoGuessr" />
        </a>

        <span className="tg-hd-nav-link" style={{ left: 188, width: 93.89 }}>
          Singleplayer
        </span>
        <div className="tg-hd-nav-chevron" style={{ left: 289.69 }}>
          <img src={chevronDown} alt="" />
        </div>
        <span className="tg-hd-nav-link" style={{ left: 321.69, width: 86.45 }}>
          Multiplayer
        </span>
        <div className="tg-hd-nav-chevron" style={{ left: 415.94 }}>
          <img src={chevronDown} alt="" />
        </div>
        <span className="tg-hd-nav-link" style={{ left: 447.94, width: 41.73 }}>
          Party
        </span>
        <div className="tg-hd-nav-chevron" style={{ left: 497.47 }}>
          <img src={chevronDown} alt="" />
        </div>
        <div className="tg-hd-nav-divider" />
        <a className="tg-hd-sub-link" href="#community" style={{ left: 554.47 }}>
          Community
        </a>
        <div className="tg-hd-shop-link">
          <a className="tg-hd-sub-link" href="#shop">
            Shop
          </a>
          <span className="tg-hd-shop-dot" />
        </div>
        <a className="tg-hd-sub-link" href="#merch" style={{ left: 701.97 }}>
          Merch
        </a>
        <a className="tg-hd-sub-link" href="#world-championship" style={{ left: 764.89 }}>
          World Championship
        </a>

        <div className="tg-hd-profile">
          <div className="tg-hd-profile-avatar">
            <img className="tg-hd-profile-avatar-ring" src={headerAvatarRing} alt="" />
            <div className="tg-hd-profile-avatar-inner">
              <img src={headerAvatarInner} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          </div>
          <div className="tg-hd-profile-name-wrap">
            <div className="tg-hd-profile-name">Maximpolakovskij</div>
            <img className="tg-hd-profile-xp-bar" src={headerXpBar} alt="" />
            <span className="tg-hd-profile-xp-label">75</span>
          </div>
        </div>
        <div className="tg-hd-nav-chevron" style={{ left: 1788 }}>
          <img src={chevronDown} alt="" />
        </div>

        <button type="button" className="tg-hd-flame-btn" aria-label="Daily streak">
          <div className="tg-hd-flame-bg">
            <span className="tg-hd-flame-label">4</span>
          </div>
        </button>

        <button type="button" className="tg-hd-search-btn" aria-label="Search">
          <img src={searchIcon} alt="" />
        </button>
      </header>

      <aside className="tg-hd-left-rail">
        <div className="tg-hd-streak">
          <div className="tg-hd-streak-label">
            <span>0 days streak</span>
          </div>
          <div className="tg-hd-streak-grid">
            {STREAK_DAYS.map((day, i) => (
              <span key={i} className="tg-hd-streak-day-label" style={{ left: 21.69 + i * 29.21 }}>
                {day.label}
              </span>
            ))}
            {STREAK_DAYS.map((day, i) => (
              <span
                key={i}
                className={`tg-hd-streak-cell${day.active ? ' tg-hd-streak-cell--active' : ''}${day.dim ? ' tg-hd-streak-cell--dim' : ''}`}
                style={{ left: 12.25 + i * 29 }}
              >
                {day.num}
              </span>
            ))}
            <div className="tg-hd-streak-flame">
              <img src={streakFlameShadow} alt="" />
            </div>
          </div>
        </div>

        <div className="tg-hd-nav-cards">
          <a className="tg-hd-nav-card" href="#daily-challenge">
            <img className="tg-hd-nav-card-icon" src={cardDailyBg} alt="" style={{ left: 0, top: 0, width: '100%', height: '100%', position: 'absolute', objectFit: 'cover' }} />
            <img className="tg-hd-nav-card-icon" src={cardDailyIcon} alt="" />
            <span className="tg-hd-nav-card-title">Daily Challenge</span>
            <span className="tg-hd-nav-card-subtitle">3 hr left</span>
          </a>
          <a className="tg-hd-nav-card" href="#competitive">
            <img src={cardCompetitiveBg} alt="" style={{ left: 0, top: 0, width: '100%', height: '100%', position: 'absolute', objectFit: 'cover' }} />
            <img className="tg-hd-nav-card-icon" src={cardCompetitiveIcon} alt="" />
            <span className="tg-hd-nav-card-title">Competitive</span>
            <span className="tg-hd-nav-card-subtitle tg-hd-nav-card-subtitle--ranked">Get ranked</span>
          </a>
          <div className="tg-hd-nav-card" style={{ cursor: 'default' }}>
            <img src={cardWorldBg} alt="" style={{ left: 0, top: 0, width: '100%', height: '100%', position: 'absolute', objectFit: 'cover' }} />
            <img className="tg-hd-nav-card-icon" src={cardWorldIcon} alt="" />
            <span className="tg-hd-nav-card-title">World</span>
            <div className="tg-hd-nav-card-lock">
              <span>Subscribers only</span>
              <img src={proLock} alt="" />
            </div>
          </div>
        </div>

        <div className="tg-hd-happening-label">
          <span>What&apos;s happening</span>
        </div>
        <a className="tg-hd-happening-card" href="#horrorguessr">
          <img src={sidebarHorrorPromo} alt="Play HorrorGuessr Now!" />
        </a>
      </aside>

      <main className="tg-hd-main">
        <div className="tg-hd-recent">
          <div className="tg-hd-recent-tag">
            <div className="tg-hd-recent-tag-bg" />
          </div>
          <span className="tg-hd-recent-tag-text">Recent</span>
          <span className="tg-hd-recent-tag-dot" style={{ left: 26 }} />
          <div className="tg-hd-recent-face" style={{ left: 115.35 }}>
            <img src={matchupPatrick} alt="Patrick" />
          </div>
          <span className="tg-hd-recent-name" style={{ left: 151.35 }}>
            Patrick
          </span>
          <div className="tg-hd-recent-flag" style={{ left: 208.82 }}>
            <img src={flagPatrick} alt="" />
          </div>
          <span className="tg-hd-recent-vs">VS.</span>
          <div className="tg-hd-recent-face" style={{ left: 294 }}>
            <img src={matchupUnclepanda} alt="Unclepanda" />
          </div>
          <span className="tg-hd-recent-name" style={{ left: 330 }}>
            Unclepanda
          </span>
          <div className="tg-hd-recent-flag" style={{ left: 423.8 }}>
            <img src={flagUnclepanda} alt="" />
          </div>
          <button type="button" className="tg-hd-recent-arrow" aria-label="Next matchup">
            <img src={arrowLeft} alt="" />
          </button>
        </div>

        <div className="tg-hd-online">
          <div className="tg-hd-online-face" style={{ left: 0 }}>
            <img src={onlineFace1} alt="" />
          </div>
          <div className="tg-hd-online-face" style={{ left: 24 }}>
            <img src={onlineFace2} alt="" />
          </div>
          <div className="tg-hd-online-face" style={{ left: 48 }}>
            <img src={onlineFace3} alt="" />
          </div>
          <span className="tg-hd-online-count">
            13,486<span> players online</span>
          </span>
        </div>

        <div className="tg-hd-avatar-stage">
          <img className="tg-hd-globe" src={globeBottom} alt="" />
          <img className="tg-hd-avatar" src={avatarGlobeTop} alt="Player avatar" />
          <button type="button" className="tg-hd-edit-avatar">
            <span>Edit avatar</span>
            <i className="tg-hd-edit-avatar-dot" />
          </button>
        </div>

        <div className="tg-hd-horror-card">
          <a className="tg-hd-horror-card-inner" href="#horrormode">
            <span className="tg-hd-horror-card-title">Play our free horrormode</span>
            <span className="tg-hd-horror-card-play">
              <span>Play now</span>
            </span>
            <img className="tg-hd-horror-card-char" src={horrorChar} alt="" />
          </a>
        </div>

        <div className="tg-hd-footer-social">
          {SOCIAL_LINKS.map((s) => (
            <a key={s.name} href={`#${s.name.toLowerCase()}`} aria-label={s.name}>
              <img src={s.icon} alt="" />
            </a>
          ))}
        </div>

        <div className="tg-hd-subscription">
          <img className="tg-hd-subscription-illustration" src={subscriptionIllustration} alt="" />
          <p className="tg-hd-subscription-title">Subscribe to play without limits!</p>
          <div className="tg-hd-subscription-list">
            <div className="tg-hd-subscription-item">
              <span className="tg-hd-subscription-check">
                <img src={checkmark} alt="" />
              </span>
              <span>Ad free, unlimited play</span>
            </div>
            <div className="tg-hd-subscription-item">
              <span className="tg-hd-subscription-check">
                <img src={checkmark} alt="" />
              </span>
              <span>1000s of maps</span>
            </div>
            <div className="tg-hd-subscription-item">
              <span className="tg-hd-subscription-check">
                <img src={checkmark} alt="" />
              </span>
              <span>Play on web, apps or Steam</span>
            </div>
          </div>
          <span className="tg-hd-subscription-price">From €3.99/month</span>
          <button type="button" className="tg-hd-subscription-cta">
            <span>View plans</span>
          </button>
        </div>
      </main>

      <div className="tg-hd-right-flyout">
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
