import { useState } from 'react'
import bgHero from '../../assets/auth/bg-hero.jpg'
import logo from '../../assets/auth/logo.svg'
import geoPin from '../../assets/auth/geo-pin.svg'
import logoMono from '../../assets/auth/logo-mono.svg'
import iconPlus from '../../assets/auth/icon-plus.svg'
import { AuthDialog } from './AuthDialog'
import './MobileAuth.css'

const FAQ_ITEMS = [
  { q: 'What is TerraGuessr?', a: 'Guess locations from weather clues alone — no street view.' },
  { q: 'How is my score calculated?', a: 'Score is based on the distance between your guess and the actual location.' },
  { q: 'Do I need an account to play?', a: 'No — solo rounds work without signing in.' },
]

export function MobileAuth() {
  const [dialog, setDialog] = useState<'login' | 'register' | null>(null)
  const [openFaq, setOpenFaq] = useState<string | null>(null)

  return (
    <div className="tg-m-page">
      <section className="tg-m-hero">
        <img className="tg-m-hero-bg" src={bgHero} alt="" />
        <div className="tg-m-overlay-purple" />
        <div className="tg-m-overlay-dark" />

        <header className="tg-m-header">
          <img className="tg-m-pin" src={geoPin} alt="TerraGuessr" />
        </header>

        <img className="tg-m-logo" src={logo} alt="TerraGuessr" />

        <h1 className="tg-m-heading">
          Explore the
          <br />
          world!
        </h1>

        <p className="tg-m-subtitle">
          Get dropped into a mystery spot with nothing but live weather data to go on.
        </p>
      </section>

      <div className="tg-m-play-bar">
        <button type="button" className="tg-m-play-now" onClick={() => setDialog('register')}>
          Play now
        </button>
      </div>

      <footer className="tg-m-footer">
        <h3 className="tg-m-footer-heading">Frequently asked questions</h3>
        {FAQ_ITEMS.map((item) => (
          <div className="tg-m-faq-row" key={item.q}>
            <button
              type="button"
              className="tg-m-faq-button"
              aria-expanded={openFaq === item.q}
              onClick={() => setOpenFaq((current) => (current === item.q ? null : item.q))}
            >
              <span>{item.q}</span>
              <img src={iconPlus} alt="" />
            </button>
            {openFaq === item.q && <p className="tg-m-faq-answer">{item.a}</p>}
          </div>
        ))}

        <button type="button" className="tg-m-footer-link" onClick={() => setDialog('login')}>
          Already have an account? Log in
        </button>

        <img className="tg-m-footer-logo" src={logoMono} alt="TerraGuessr" />
        <p className="tg-m-footer-copyright">TerraGuessr — a weather-clue geography game.</p>
      </footer>

      {dialog && <AuthDialog variant="mobile" initialMode={dialog} onClose={() => setDialog(null)} />}
    </div>
  )
}
