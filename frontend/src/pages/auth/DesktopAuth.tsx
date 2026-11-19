import { useState } from 'react'
import bgHero from '../../assets/auth/bg-hero.jpg'
import logo from '../../assets/auth/logo.svg'
import geoPin from '../../assets/auth/geo-pin.svg'
import logoMono from '../../assets/auth/logo-mono.svg'
import iconPlus from '../../assets/auth/icon-plus.svg'
import { AuthDialog } from './AuthDialog'
import './DesktopAuth.css'

const FAQ_ITEMS = [
  { q: 'What is TerraGuessr?', a: 'Guess locations from weather clues alone — no street view. Play solo rounds across difficulty levels, or challenge a friend to the same spot and compare scores on a shared leaderboard.' },
  { q: 'How is my score calculated?', a: 'Score is based on the distance between your guess and the actual location — the closer you are, the higher you score.' },
  { q: 'Is TerraGuessr available on mobile?', a: 'TerraGuessr runs in any modern browser, including mobile browsers. There is no native app yet.' },
  { q: 'Do I need an account to play?', a: 'No — solo rounds work without signing in. An account unlocks saved stats, the daily challenge, and challenge links tied to your name.' },
]

export function DesktopAuth() {
  const [dialog, setDialog] = useState<'login' | 'register' | null>(null)
  const [openFaq, setOpenFaq] = useState<string | null>(null)

  return (
    <div className="tg-d-page">
      <section className="tg-d-hero">
        <img className="tg-d-hero-bg" src={bgHero} alt="" />
        <div className="tg-d-overlay-purple" />
        <div className="tg-d-overlay-dark" />

        <header className="tg-d-header">
          <img className="tg-d-pin" src={geoPin} alt="TerraGuessr" />

          <button type="button" className="tg-d-login-link" onClick={() => setDialog('login')}>
            Log in
          </button>
          <button type="button" className="tg-d-signup-btn" onClick={() => setDialog('register')}>
            <span className="tg-d-signup-btn-text">Sign up</span>
          </button>
        </header>

        <img className="tg-d-logo" src={logo} alt="TerraGuessr" />

        <h1 className="tg-d-heading">
          Explore the
          <br />
          world!
        </h1>

        <p className="tg-d-subtitle">
          Get dropped into a mystery spot with nothing but live weather data to go on.
          <br />
          How far off can your guess be?
        </p>
      </section>

      <footer className="tg-d-footer">
        <div className="tg-d-footer-brand">
          <img className="tg-d-footer-logo" src={logoMono} alt="TerraGuessr" />
          <p className="tg-d-footer-copyright">TerraGuessr — a weather-clue geography game.</p>
        </div>

        <div className="tg-d-footer-faq">
          <h3 className="tg-d-footer-heading">Frequently asked questions</h3>
          {FAQ_ITEMS.map((item) => (
            <div className="tg-d-faq-row" key={item.q}>
              <button
                type="button"
                className="tg-d-faq-button"
                aria-expanded={openFaq === item.q}
                onClick={() => setOpenFaq((current) => (current === item.q ? null : item.q))}
              >
                <span>{item.q}</span>
                <img src={iconPlus} alt="" className={openFaq === item.q ? 'tg-d-faq-icon--open' : ''} />
              </button>
              {openFaq === item.q && <p className="tg-d-faq-answer">{item.a}</p>}
            </div>
          ))}
        </div>
      </footer>

      {dialog && <AuthDialog variant="desktop" initialMode={dialog} onClose={() => setDialog(null)} />}
    </div>
  )
}
