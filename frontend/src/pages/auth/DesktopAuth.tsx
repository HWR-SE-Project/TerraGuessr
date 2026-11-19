import { useState } from 'react'
import bgHero from '../../assets/auth/bg-hero.jpg'
import logo from '../../assets/auth/logo.svg'
import availableOn from '../../assets/auth/available-on.svg'
import ratingStar from '../../assets/auth/rating-star.svg'
import horrorThumb from '../../assets/auth/horror-thumb.png'
import arrowIcon from '../../assets/auth/arrow.svg'
import playIcon from '../../assets/auth/play-icon.svg'
import pauseIcon from '../../assets/auth/pause-icon.svg'
import geoPin from '../../assets/auth/geo-pin.png'
import languageIcon from '../../assets/auth/language-icon.svg'
import chevron from '../../assets/auth/chevron.svg'
import logoMono from '../../assets/auth/logo-mono.svg'
import iconPlus from '../../assets/auth/icon-plus.svg'
import { AuthDialog } from './AuthDialog'
import './DesktopAuth.css'

const FAQ_ITEMS = [
  'What is GeoGuessr?',
  'I have trouble accessing my account.',
  'Is GeoGuessr available on App Store and Google Play?',
  'What languages is GeoGuessr available in?',
  'What is Seterra?',
]

export function DesktopAuth() {
  const [videoPlaying, setVideoPlaying] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogView, setDialogView] = useState<'providers' | 'email'>('providers')

  function openDialog() {
    setDialogView('providers')
    setDialogOpen(true)
  }

  return (
    <div className="tg-d-page">
      <section className="tg-d-hero">
        <img className="tg-d-hero-bg" src={bgHero} alt="" />
        <div className="tg-d-overlay-purple" />
        <div className="tg-d-overlay-dark" />

        <header className="tg-d-header">
          <img className="tg-d-pin" src={geoPin} alt="" />
          <a className="tg-d-nav-link" style={{ left: 86 }} href="#world-championship">
            World Championship &apos;26
          </a>
          <a className="tg-d-nav-link" style={{ left: 252.17 }} href="#organizations">
            Organizations
          </a>
          <a className="tg-d-nav-link" style={{ left: 360.88 }} href="#merch">
            Merch
          </a>
          <a className="tg-d-nav-link" style={{ left: 417.8 }} href="#gift-cards">
            Gift Cards
          </a>

          <div className="tg-d-lang">
            <img className="tg-d-lang-icon" src={languageIcon} alt="" />
            <span className="tg-d-lang-text">English</span>
            <img className="tg-d-lang-chevron" src={chevron} alt="" />
          </div>

          <span className="tg-d-code-label">Code</span>
          <div className="tg-d-code-inputs">
            <input className="tg-d-code-input" maxLength={1} aria-label="Code digit 1" />
            <input className="tg-d-code-input" maxLength={1} aria-label="Code digit 2" />
            <input className="tg-d-code-input" maxLength={1} aria-label="Code digit 3" />
            <input className="tg-d-code-input" maxLength={1} aria-label="Code digit 4" />
            <input className="tg-d-code-input" maxLength={1} aria-label="Code digit 5" />
          </div>

          <button type="button" className="tg-d-login-link" onClick={openDialog}>
            Log in
          </button>
          <button type="button" className="tg-d-signup-btn" onClick={openDialog}>
            <span className="tg-d-signup-btn-text">Sign up</span>
          </button>
        </header>

        <img className="tg-d-logo" src={logo} alt="GeoGuessr" />

        <h1 className="tg-d-heading">
          Explore the
          <br />
          world!
        </h1>

        <p className="tg-d-subtitle">
          Get dropped anywhere from the busy streets of New York to the beautiful beaches of
          <br />
          Bali. Join 100 million players today!
        </p>

        <img className="tg-d-available-on" src={availableOn} alt="Available on Web, Steam, iOS and Android" />
        <span className="tg-d-badge-caption tg-d-badge-caption--platform">
          Play on Web, Steam iOS and Android
        </span>

        <div className="tg-d-divider" />

        <img className="tg-d-rating-star" src={ratingStar} alt="4.5 out of 5 stars" />
        <span className="tg-d-badge-caption tg-d-badge-caption--rating">
          4.5/5 rating in App Store
        </span>

        <a className="tg-d-horror-card" href="#horrormode">
          <span className="tg-d-horror-text">
            Play our
            <br />
            free horrormode
          </span>
          <img className="tg-d-horror-arrow" src={arrowIcon} alt="" />
          <img className="tg-d-horror-image" src={horrorThumb} alt="" />
        </a>

        <button
          type="button"
          className="tg-d-video-toggle"
          onClick={() => setVideoPlaying((v) => !v)}
          aria-label={videoPlaying ? 'Pause background video' : 'Play background video'}
        >
          <img src={videoPlaying ? pauseIcon : playIcon} alt="" />
        </button>

        <a className="tg-d-corner-link" href="#support" aria-label="Support" />
      </section>

      <footer className="tg-d-footer">
        <div className="tg-d-footer-brand">
          <img className="tg-d-footer-logo" src={logoMono} alt="GeoGuessr" />
          <p className="tg-d-footer-address">
            GeoGuessr AB
            <br />
            Katarinavägen 17
            <br />
            116 45 Stockholm, Sweden
          </p>
          <p className="tg-d-footer-copyright">© 2026 GeoGuessr AB</p>
        </div>

        <div className="tg-d-footer-explore">
          <h3 className="tg-d-footer-heading">Explore</h3>
          <a className="tg-d-footer-link" href="#world-championship">
            World Championship &apos;26
          </a>
          <a className="tg-d-footer-link" href="#organizations">
            Organizations
          </a>
          <a className="tg-d-footer-link" href="#merch">
            Merch
          </a>
          <a className="tg-d-footer-link" href="#gift-cards">
            Gift cards
          </a>
        </div>

        <div className="tg-d-footer-faq">
          <h3 className="tg-d-footer-heading">Frequently asked questions</h3>
          {FAQ_ITEMS.map((item) => (
            <div className="tg-d-faq-row" key={item}>
              <button type="button" className="tg-d-faq-button">
                <span>{item}</span>
                <img src={iconPlus} alt="" />
              </button>
            </div>
          ))}
          <div className="tg-d-faq-row tg-d-faq-row--plain">
            <button type="button" className="tg-d-faq-button">
              <span>Business enquiries</span>
              <img src={iconPlus} alt="" />
            </button>
          </div>
        </div>
      </footer>

      {dialogOpen && (
        <AuthDialog
          variant="desktop"
          view={dialogView}
          onClose={() => setDialogOpen(false)}
          onContinueWithEmail={() => setDialogView('email')}
          onBack={() => setDialogView('providers')}
        />
      )}
    </div>
  )
}
