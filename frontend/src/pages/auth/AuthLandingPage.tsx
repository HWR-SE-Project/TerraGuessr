import { useState } from 'react'
import bgHero from '../../assets/auth/bg-hero.jpg'
import logo from '../../assets/auth/logo.svg'
import availableOn from '../../assets/auth/available-on.svg'
import ratingStar from '../../assets/auth/rating-star.svg'
import geoPin from '../../assets/auth/geo-pin.png'
import languageIcon from '../../assets/auth/language-icon.svg'
import chevron from '../../assets/auth/chevron.svg'
import googleLogo from '../../assets/auth/google-logo.svg'
import appleLogo from '../../assets/auth/apple-logo.svg'
import facebookLogo from '../../assets/auth/facebook-logo.svg'
import playIcon from '../../assets/auth/play-icon.svg'
import pauseIcon from '../../assets/auth/pause-icon.svg'
import './AuthLandingPage.css'

export function AuthLandingPage() {
  const [playing, setPlaying] = useState(true)

  return (
    <main className="geo-landing">
      <img className="geo-landing__background" src={bgHero} alt="" />
      <div className="geo-landing__purple" />
      <div className="geo-landing__shade" />

      <header className="geo-landing__header">
        <img className="geo-landing__pin" src={geoPin} alt="GeoGuessr" />
        <nav className="geo-landing__nav" aria-label="Main navigation">
          <a href="#world-championship">World Championship &apos;26</a>
          <a href="#organizations">Organizations</a>
          <a href="#merch">Merch</a>
          <a href="#gift-cards">Gift Cards</a>
        </nav>
        <div className="geo-landing__actions">
          <button className="geo-landing__language" type="button">
            <img src={languageIcon} alt="" /> <span>English</span><img className="geo-landing__chevron" src={chevron} alt="" />
          </button>
          <span className="geo-landing__code-label">Code</span>
          <div className="geo-landing__code" aria-label="Enter your code">
            {Array.from({ length: 5 }, (_, index) => <input key={index} maxLength={1} aria-label={`Code digit ${index + 1}`} />)}
          </div>
          <button className="geo-landing__login" type="button">Log in</button>
          <button className="geo-landing__signup" type="button">Sign up</button>
        </div>
      </header>

      <section className="geo-landing__hero" aria-label="Explore the world">
        <img className="geo-landing__logo" src={logo} alt="GeoGuessr" />
        <h1>Explore the<br />world!</h1>
        <p className="geo-landing__subtitle">Get dropped anywhere from the busy streets of New York to the beautiful beaches of<br className="geo-landing__wide-break" /> Bali. Join 100 million players today!</p>
        <div className="geo-landing__badges">
          <div className="geo-landing__platform">
            <img src={availableOn} alt="Available on Web, Steam, iOS and Android" />
            <span>Play on Web, Steam iOS and Android</span>
          </div>
          <div className="geo-landing__badge-divider" />
          <div className="geo-landing__rating">
            <img src={ratingStar} alt="4.5 out of 5 stars" />
            <span>4.5/5 rating in App Store</span>
          </div>
        </div>
      </section>

      <section className="geo-landing__signup-card" aria-label="Sign up to play">
        <h2>Sign up to play</h2>
        <div className="geo-landing__provider-buttons">
          <button className="geo-landing__provider geo-landing__provider--google" type="button"><img src={googleLogo} alt="" /><span>Continue with Google</span></button>
          <button className="geo-landing__provider geo-landing__provider--apple" type="button"><img src={appleLogo} alt="" /><span>Continue with Apple</span></button>
          <button className="geo-landing__provider geo-landing__provider--facebook" type="button"><img src={facebookLogo} alt="" /><span>Continue with Facebook</span></button>
          <button className="geo-landing__provider geo-landing__provider--email" type="button">Continue with Email</button>
        </div>
        <div className="geo-landing__or"><span /> <b>Or</b> <span /></div>
        <div className="geo-landing__card-footer"><span>Already have an account?</span><button type="button">Log in</button></div>
      </section>

      <button className="geo-landing__pause" type="button" onClick={() => setPlaying(value => !value)} aria-label={playing ? 'Pause background video' : 'Play background video'}>
        <img src={playing ? pauseIcon : playIcon} alt="" />
      </button>
    </main>
  )
}
