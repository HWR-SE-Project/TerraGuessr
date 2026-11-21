import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { AppHeader } from '../../components/layout/AppHeader'
import googleLogo from '../../assets/auth/google-logo.svg'
import { googleSignInUrl } from '../../api/auth'
import { useSession } from '../../state/SessionContext'
import { Button } from '../../components/ui/Button'
import { EmailAuthForm } from '../../components/auth/EmailAuthForm'
import { ForgotPasswordForm } from '../../components/auth/ForgotPasswordForm'
import { InlineNotice } from '../../components/ui/InlineNotice'
import './AuthPage.css'

type CardView = 'providers' | 'email' | 'forgot'
type AuthMode = 'login' | 'register'

export function AuthPage() {
  const { status, user, authConfig } = useSession()
  const navigate = useNavigate()
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

  if (status === 'ready' && user) return <Navigate to="/" replace />

  return (
    <>
      <AppHeader />
      <main className="geo-landing">
        <div className="geo-landing__content">
        <section className="geo-landing__hero" aria-labelledby="explore-title">
          <h1 id="explore-title">
            A little lost.
            <br />
            <span>A lot to discover.</span>
          </h1>
          <p className="geo-landing__subtitle">
            From quiet backstreets to somewhere breathtaking. Follow the clues,
            trust your instincts, and see where curiosity takes you.
          </p>
        </section>

        <section
          className="geo-landing__signup-card tg-glass"
          aria-label="Play TerraGuessr"
        >
          {cardView === 'providers' ? (
            <>
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
                <Button
                  variant="light"
                  className="geo-landing__provider geo-landing__provider--google"
                  onClick={() => {
                    if (authConfig?.googleAvailable)
                      window.location.href = googleSignInUrl()
                    else setUnavailableProvider('Google')
                  }}
                >
                  <img src={googleLogo} alt="" />
                  <span>Continue with Google</span>
                </Button>
                <Button
                  variant="tinted"
                  className="geo-landing__provider geo-landing__provider--email"
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
                </Button>
              </div>
              {unavailableProvider && (
                <InlineNotice tone="warning">
                  {unavailableProvider} sign-in isn&apos;t available yet. Please
                  continue with email.
                </InlineNotice>
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
                  onSuccess={() => navigate('/')}
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
    </>
  )
}
