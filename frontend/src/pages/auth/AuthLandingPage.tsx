import { useState } from 'react'
import { Brand } from '../../components/ui/Brand'
import earthHorizon from '../../assets/auth/earth-horizon.webp'
import googleLogo from '../../assets/auth/google-logo.svg'
import appleLogo from '../../assets/auth/apple-logo.svg'
import { googleSignInUrl } from '../../api/auth'
import { useSession } from '../../state/SessionContext'
import { EmailAuthForm } from '../../components/auth/EmailAuthForm'
import { ForgotPasswordForm } from '../../components/auth/ForgotPasswordForm'
import { UnavailableNotice } from '../../components/UnavailableNotice'
import './AuthLandingPage.css'

type CardView = 'providers' | 'email' | 'forgot'
type AuthMode = 'login' | 'register'

export function AuthLandingPage() {
  const { authConfig, refresh } = useSession()
  const [cardView, setCardView] = useState<CardView>('providers')
  const [cardMode, setCardMode] = useState<AuthMode>('register')
  const [unavailableProvider, setUnavailableProvider] = useState<string | null>(
    null,
  )

  function showProviders(mode: AuthMode) {
    setCardMode(mode)
    setCardView('providers')
    setUnavailableProvider(null)
  }

  return (
    <main className="geo-landing">
      <img
        className="geo-landing__background"
        src={earthHorizon}
        alt=""
        fetchPriority="high"
      />
      <div className="geo-landing__contours" aria-hidden="true" />

      <header className="geo-landing__header">
        <a
          className="geo-landing__brand"
          href="/"
          aria-label="TerraGuessr home"
        >
          <Brand />
        </a>
        <nav className="geo-landing__actions" aria-label="Account">
          <button
            className="geo-landing__login"
            type="button"
            onClick={() => showProviders('login')}
          >
            Log in
          </button>
          <button
            className="geo-landing__signup"
            type="button"
            onClick={() => showProviders('register')}
          >
            Sign up
          </button>
        </nav>
      </header>

      <div className="geo-landing__content">
        <section className="geo-landing__hero" aria-labelledby="explore-title">
          <p className="geo-landing__eyebrow">A WORLD WAITING TO BE FOUND</p>
          <h1 id="explore-title">
            A little lost.
            <br />
            <span>A lot to discover.</span>
          </h1>
          <p className="geo-landing__subtitle">
            From quiet backstreets to somewhere breathtaking. Follow the clues,
            trust your instincts, and see where curiosity takes you.
          </p>
          <div className="geo-landing__hero-note">
            <span>01 / EXPLORE</span>
            <span>02 / GUESS</span>
            <span>03 / DISCOVER</span>
          </div>
        </section>

        <section
          className="geo-landing__signup-card"
          aria-label="Play TerraGuessr"
        >
          {cardView === 'providers' ? (
            <>
              <span className="geo-landing__card-eyebrow">
                YOUR NEXT ADVENTURE
              </span>
              <h2>
                {cardMode === 'login'
                  ? 'Welcome back.'
                  : 'The world is calling.'}
              </h2>
              <p className="geo-landing__card-intro">
                {cardMode === 'login'
                  ? 'Pick up where your curiosity left off.'
                  : 'Create an account. Find your bearings.'}
              </p>
              <div className="geo-landing__provider-buttons">
                <button
                  className="geo-landing__provider geo-landing__provider--google"
                  type="button"
                  onClick={() => {
                    if (authConfig?.googleAvailable)
                      window.location.href = googleSignInUrl()
                    else setUnavailableProvider('Google')
                  }}
                >
                  <img src={googleLogo} alt="" />
                  <span>Continue with Google</span>
                </button>
                <button
                  className="geo-landing__provider geo-landing__provider--apple"
                  type="button"
                  onClick={() => setUnavailableProvider('Apple')}
                >
                  <img src={appleLogo} alt="" />
                  <span>Continue with Apple</span>
                </button>
                <button
                  className="geo-landing__provider geo-landing__provider--facebook"
                  type="button"
                  onClick={() => setUnavailableProvider('Facebook')}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073c0 6.026 4.388 11.021 10.125 11.927v-8.437H7.078v-3.49h3.047v-2.66c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.49 0-1.956.931-1.956 1.887v2.264h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073Z" />
                  </svg>
                  <span>Continue with Facebook</span>
                </button>
                <button
                  className="geo-landing__provider geo-landing__provider--email"
                  type="button"
                  onClick={() => setCardView('email')}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    aria-hidden="true"
                  >
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <path d="m3 6 8 7a1.5 1.5 0 0 0 2 0l8-7" />
                  </svg>
                  <span>Continue with Email</span>
                </button>
              </div>
              {unavailableProvider && (
                <UnavailableNotice>
                  {unavailableProvider} sign-in isn&apos;t available yet. Please
                  continue with email.
                </UnavailableNotice>
              )}
              <div className="geo-landing__or">
                <span /> <b>OR</b> <span />
              </div>
              <div className="geo-landing__card-footer">
                <span>
                  {cardMode === 'login'
                    ? "Don't have an account?"
                    : 'Already have an account?'}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    showProviders(cardMode === 'login' ? 'register' : 'login')
                  }
                >
                  {cardMode === 'login' ? 'Sign up' : 'Log in'}
                </button>
              </div>
            </>
          ) : (
            <>
              <button
                className="geo-landing__back"
                type="button"
                onClick={() => showProviders(cardMode)}
              >
                <span aria-hidden="true">←</span> All sign-in options
              </button>
              {cardView === 'email' ? (
                <EmailAuthForm
                  key={cardMode}
                  initialMode={cardMode}
                  onSuccess={refresh}
                  onForgotPassword={() => {
                    setCardMode('login')
                    setCardView('forgot')
                  }}
                />
              ) : (
                <ForgotPasswordForm onBack={() => setCardView('email')} />
              )}
            </>
          )}
        </section>
      </div>
    </main>
  )
}
