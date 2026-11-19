import hamburger from '../../assets/home/mobile/hamburger.svg'
import searchIcon from '../../assets/home/mobile/search-icon.svg'
import avatarRing from '../../assets/home/mobile/header-avatar-ring.png'
import avatarInner from '../../assets/home/mobile/header-avatar-inner.png'
import chevronDown from '../../assets/home/mobile/chevron-down.svg'
import bellIcon from '../../assets/home/mobile/bell-icon.svg'
import onlineFace1 from '../../assets/home/mobile/online-face-1.png'
import onlineFace2 from '../../assets/home/mobile/online-face-2.png'
import onlineFace3 from '../../assets/home/mobile/online-face-3.png'
import horrorChar from '../../assets/home/mobile/horror-char.png'
import subscriptionIllustration from '../../assets/home/mobile/subscription-illustration.png'
import checkmark from '../../assets/home/mobile/checkmark.svg'
import socialTwitch from '../../assets/home/mobile/social-twitch.svg'
import socialReddit from '../../assets/home/mobile/social-reddit.svg'
import socialDiscord from '../../assets/home/mobile/social-discord-fill.svg'
import socialFacebook from '../../assets/home/mobile/social-facebook.svg'
import socialInstagram from '../../assets/home/mobile/social-instagram.svg'
import socialX from '../../assets/home/mobile/social-x.svg'
import socialYoutube from '../../assets/home/mobile/social-youtube.svg'
import socialTiktok from '../../assets/home/mobile/social-tiktok.svg'
import globeBottom from '../../assets/home/mobile/globe-bottom.png'
import avatarGlobeTop from '../../assets/home/mobile/avatar-globe-top.png'
import navHomeIcon from '../../assets/home/mobile/nav-home-icon.png'
import navDailyIcon from '../../assets/home/mobile/nav-daily-icon.png'
import navCompetitiveIcon from '../../assets/home/mobile/nav-competitive-icon.png'
import navWorldIcon from '../../assets/home/mobile/nav-world-icon.png'
import './MobileHome.css'

const SOCIAL_LINKS = [
  { name: 'Twitch', icon: socialTwitch, left: 0 },
  { name: 'Reddit', icon: socialReddit, left: 47.14 },
  { name: 'Discord', icon: socialDiscord, left: 94.28 },
  { name: 'Facebook', icon: socialFacebook, left: 141.42 },
  { name: 'Instagram', icon: socialInstagram, left: 188.58 },
  { name: 'X', icon: socialX, left: 235.72 },
  { name: 'YouTube', icon: socialYoutube, left: 282.86 },
  { name: 'TikTok', icon: socialTiktok, left: 330 },
]

export function MobileHome() {
  return (
    <div className="tg-hm-page">
      <div className="tg-hm-bg-glow" />
      <div className="tg-hm-bg-radial" />

      <header className="tg-hm-header">
        <button type="button" className="tg-hm-hamburger" aria-label="Menu">
          <img src={hamburger} alt="" />
        </button>
        <button type="button" className="tg-hm-search-btn" aria-label="Search">
          <img src={searchIcon} alt="" />
        </button>
        <button type="button" className="tg-hm-avatar-btn" aria-label="Profile">
          <img className="tg-hm-avatar-ring" src={avatarRing} alt="" />
          <div className="tg-hm-avatar-inner">
            <img src={avatarInner} alt="" />
          </div>
        </button>
        <img className="tg-hm-chevron" src={chevronDown} alt="" />
        <button type="button" className="tg-hm-flame-btn" aria-label="Daily streak">
          <div className="tg-hm-flame-bg">
            <span className="tg-hm-flame-label">4</span>
          </div>
        </button>
        <button type="button" className="tg-hm-friends-btn" aria-label="Friends">
          <img src={bellIcon} alt="" />
        </button>
        <span className="tg-hm-friends-badge">1</span>
      </header>

      <main className="tg-hm-main">
        <div className="tg-hm-online">
          <div className="tg-hm-online-face" style={{ left: 0 }}>
            <img src={onlineFace1} alt="" />
          </div>
          <div className="tg-hm-online-face" style={{ left: 24 }}>
            <img src={onlineFace2} alt="" />
          </div>
          <div className="tg-hm-online-face" style={{ left: 48 }}>
            <img src={onlineFace3} alt="" />
          </div>
          <span className="tg-hm-online-count">
            13,493<span> players online</span>
          </span>
        </div>

        <div className="tg-hm-section">
          <div className="tg-hm-horror-card">
            <a className="tg-hm-horror-card-inner" href="#horrormode">
              <span className="tg-hm-horror-card-title">Play our free horrormode</span>
              <span className="tg-hm-horror-card-play">
                <span>Play now</span>
              </span>
              <img className="tg-hm-horror-card-char" src={horrorChar} alt="" />
            </a>
          </div>

          <div className="tg-hm-subscription">
            <img className="tg-hm-subscription-illustration" src={subscriptionIllustration} alt="" />
            <p className="tg-hm-subscription-title">
              Subscribe to play
              <br />
              without limits!
            </p>
            <div className="tg-hm-subscription-list">
              <div className="tg-hm-subscription-item">
                <span className="tg-hm-subscription-check">
                  <img src={checkmark} alt="" />
                </span>
                <span>Ad free, unlimited play</span>
              </div>
              <div className="tg-hm-subscription-item">
                <span className="tg-hm-subscription-check">
                  <img src={checkmark} alt="" />
                </span>
                <span>1000s of maps</span>
              </div>
              <div className="tg-hm-subscription-item">
                <span className="tg-hm-subscription-check">
                  <img src={checkmark} alt="" />
                </span>
                <span>Play on web, apps or Steam</span>
              </div>
            </div>
            <span className="tg-hm-subscription-price">From €3.99/month</span>
            <button type="button" className="tg-hm-subscription-cta">
              <span>View plans</span>
            </button>
          </div>

          <div className="tg-hm-footer-social">
            {SOCIAL_LINKS.map((s) => (
              <a key={s.name} href={`#${s.name.toLowerCase()}`} aria-label={s.name} style={{ left: s.left }}>
                <img src={s.icon} alt="" />
              </a>
            ))}
          </div>

          <div className="tg-hm-avatar-stage">
            <img className="tg-hm-globe" src={globeBottom} alt="" />
            <img className="tg-hm-avatar" src={avatarGlobeTop} alt="Player avatar" />
            <button type="button" className="tg-hm-edit-avatar">
              <span>Edit avatar</span>
              <i className="tg-hm-edit-avatar-dot" />
            </button>
          </div>
        </div>
      </main>

      <nav className="tg-hm-nav">
        <div className="tg-hm-nav-list">
          <a className="tg-hm-nav-item tg-hm-nav-item--active" href="/">
            <div className="tg-hm-nav-highlight" />
            <img src={navHomeIcon} alt="" style={{ marginTop: -8 }} />
            <span>Home</span>
          </a>
          <a className="tg-hm-nav-item" href="#daily-challenge">
            <img src={navDailyIcon} alt="" style={{ marginTop: -15 }} />
            <span>
              Daily
              <br />
              challenge
            </span>
          </a>
          <a className="tg-hm-nav-item" href="#competitive">
            <img src={navCompetitiveIcon} alt="" style={{ marginTop: -8 }} />
            <span>Competitive</span>
          </a>
          <div className="tg-hm-nav-item" style={{ cursor: 'default' }}>
            <img src={navWorldIcon} alt="" style={{ marginTop: -8 }} />
            <span>World</span>
          </div>
        </div>
      </nav>
    </div>
  )
}
