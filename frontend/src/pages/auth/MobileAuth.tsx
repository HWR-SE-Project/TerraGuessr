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
import './MobileAuth.css'

const FAQ_ITEMS = [
  'What is GeoGuessr?',
  'I have trouble accessing my account.',
  'Is GeoGuessr available on App Store and Google Play?',
  'What languages is GeoGuessr available in?',
  'What is Seterra?',
]

export function MobileAuth() {
  const [videoPlaying, setVideoPlaying] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogView, setDialogView] = useState<'providers' | 'email'>('providers')

  function openDialog() {
    setDialogView('providers')
    setDialogOpen(true)
  }

  return (
    <div className="tg-m-page">
      <section className="tg-m-hero">
        <img className="tg-m-hero-bg" src={bgHero} alt="" />
        <div className="tg-m-overlay-purple" />
        <div className="tg-m-overlay-dark" />

        <header className="tg-m-header">
          <img className="tg-m-pin" src={geoPin} alt="" />
          <div className="tg-m-lang">
            <img className="tg-m-lang-icon" src={languageIcon} alt="" />
            <span className="tg-m-lang-text">English</span>
            <img className="tg-m-lang-chevron" src={chevron} alt="" />
          </div>
          <span className="tg-m-code-label">Code</span>
          <div className="tg-m-code-inputs">
            <input className="tg-m-code-input" maxLength={1} aria-label="Code digit 1" />
            <input className="tg-m-code-input" maxLength={1} aria-label="Code digit 2" />
            <input className="tg-m-code-input" maxLength={1} aria-label="Code digit 3" />
            <input className="tg-m-code-input" maxLength={1} aria-label="Code digit 4" />
            <input className="tg-m-code-input" maxLength={1} aria-label="Code digit 5" />
          </div>
        </header>

        <img className="tg-m-logo" src={logo} alt="GeoGuessr" />

        <h1 className="tg-m-heading">
          Explore the
          <br />
          world!
        </h1>

        <p className="tg-m-subtitle">
          Get dropped anywhere from the busy streets of New York to the beautiful beaches of
          Bali. Join 100 million players today!
        </p>

        <img className="tg-m-available-on" src={availableOn} alt="Available on Web, Steam, iOS and Android" />
        <span className="tg-m-badge-caption tg-m-badge-caption--platform">
          Play on Web, Steam iOS and
          <br />
          Android
        </span>

        <div className="tg-m-divider" />

        <img className="tg-m-rating-star" src={ratingStar} alt="4.5 out of 5 stars" />
        <span className="tg-m-badge-caption tg-m-badge-caption--rating">
          4.5/5 rating in App
          <br />
          Store
        </span>

        <a className="tg-m-horror-card" href="#horrormode">
          <img className="tg-m-horror-image" src={horrorThumb} alt="" />
          <span className="tg-m-horror-text">Play our free horrormode</span>
          <img className="tg-m-horror-arrow" src={arrowIcon} alt="" />
        </a>

        <button
          type="button"
          className="tg-m-video-toggle"
          onClick={() => setVideoPlaying((v) => !v)}
          aria-label={videoPlaying ? 'Pause background video' : 'Play background video'}
        >
          <img src={videoPlaying ? pauseIcon : playIcon} alt="" />
        </button>

        <a className="tg-m-corner-link" href="#support" aria-label="Support" />
      </section>

      <div className="tg-m-play-bar">
        <button type="button" className="tg-m-play-now" onClick={openDialog}>
          Play now
        </button>
      </div>

      <footer className="tg-m-footer">
        <h3 className="tg-m-footer-heading">Frequently asked questions</h3>
        {FAQ_ITEMS.map((item) => (
          <div className="tg-m-faq-row" key={item}>
            <button type="button" className="tg-m-faq-button">
              <span>{item}</span>
              <img src={iconPlus} alt="" />
            </button>
          </div>
        ))}
        <div className="tg-m-faq-row tg-m-faq-row--plain">
          <button type="button" className="tg-m-faq-button">
            <span>Business enquiries</span>
            <img src={iconPlus} alt="" />
          </button>
        </div>

        <h3 className="tg-m-footer-heading tg-m-footer-heading--explore">Explore</h3>
        <a className="tg-m-footer-link" href="#world-championship">
          World Championship &apos;26
        </a>
        <a className="tg-m-footer-link" href="#organizations">
          Organizations
        </a>
        <a className="tg-m-footer-link" href="#merch">
          Merch
        </a>
        <a className="tg-m-footer-link" href="#gift-cards">
          Gift cards
        </a>

        <img className="tg-m-footer-logo" src={logoMono} alt="GeoGuessr" />
        <p className="tg-m-footer-address">
          GeoGuessr AB
          <br />
          Katarinavägen 17
          <br />
          116 45 Stockholm, Sweden
        </p>
        <p className="tg-m-footer-copyright">© 2026 GeoGuessr AB</p>
      </footer>

      {dialogOpen && (
        <AuthDialog
          variant="mobile"
          view={dialogView}
          onClose={() => setDialogOpen(false)}
          onContinueWithEmail={() => setDialogView('email')}
          onBack={() => setDialogView('providers')}
        />
      )}
    </div>
  )
}
